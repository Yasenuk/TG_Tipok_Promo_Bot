import ExcelJS from 'exceljs';
import { prisma } from '../../db/client.js';
import { formatPhone } from '../users/phone.js';
import { formatDateTime } from '../../shared/datetime.js';

const dt = formatDateTime;

const CLAIM_STATUS_UA: Record<string, string> = {
  AWAITING_STORE: 'чекає вибору магазину',
  AWAITING_DELIVERY: 'чекає доставки',
  DELIVERED: 'доставлено',
  RECEIVED: 'отримано',
  CANCELLED: 'скасовано',
  EXPIRED: 'протерміновано',
};

function styleHeader(sheet: ExcelJS.Worksheet): void {
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8E8E8' },
  };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columnCount },
  };
}

/**
 * Вигрузка по кампанії
 */
export async function buildCampaignWorkbook(
  campaignId: string,
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();

  const campaign = await prisma.campaign.findUniqueOrThrow({
    where: { id: campaignId },
  });

  // ── Активації: 1 код = 1 рядок
  const activations = await prisma.activation.findMany({
    where: { campaignId },
    orderBy: { createdAt: 'asc' },
    include: { user: true, code: true },
  });

  const sheet = workbook.addWorksheet('Активації');
  sheet.columns = [
    { header: '№', key: 'n', width: 6 },
    { header: 'Код', key: 'code', width: 18 },
    { header: 'ПІБ', key: 'name', width: 32 },
    { header: 'Телефон', key: 'phone', width: 20 },
    { header: 'Telegram', key: 'username', width: 18 },
    { header: 'Telegram ID', key: 'tgId', width: 16 },
    { header: 'Номер коду в людини', key: 'position', width: 20 },
    { header: 'Дата активації', key: 'date', width: 20 },
  ];

  activations.forEach((a, i) => {
    sheet.addRow({
      n: i + 1,
      code: a.code.displayValue ?? a.code.value,
      name: a.user.fullName ?? '',
      phone: a.user.phone ? formatPhone(a.user.phone) : '',
      username: a.user.username ? `@${a.user.username}` : '',
      tgId: a.user.telegramId.toString(),
      position: a.position,
      date: dt(a.createdAt),
    });
  });
  styleHeader(sheet);

  // ── Учасники: зведено
  const participants = await prisma.participation.findMany({
    where: { campaignId },
    orderBy: { activationCount: 'desc' },
    include: { user: true },
  });

  const usersSheet = workbook.addWorksheet('Учасники');
  usersSheet.columns = [
    { header: '№', key: 'n', width: 6 },
    { header: 'ПІБ', key: 'name', width: 32 },
    { header: 'Телефон', key: 'phone', width: 20 },
    { header: 'Telegram', key: 'username', width: 18 },
    { header: 'Telegram ID', key: 'tgId', width: 16 },
    { header: 'Кодів', key: 'count', width: 10 },
    { header: 'Приєднався', key: 'joined', width: 20 },
    { header: 'Остання активність', key: 'last', width: 20 },
    { header: 'Заблокував бота', key: 'blocked', width: 16 },
  ];

  participants.forEach((p, i) => {
    usersSheet.addRow({
      n: i + 1,
      name: p.user.fullName ?? '',
      phone: p.user.phone ? formatPhone(p.user.phone) : '',
      username: p.user.username ? `@${p.user.username}` : '',
      tgId: p.user.telegramId.toString(),
      count: p.activationCount,
      joined: dt(p.joinedAt),
      last: dt(p.lastActivityAt),
      blocked: p.user.isBlocked ? 'так' : '',
    });
  });
  styleHeader(usersSheet);

  // ── Призи: статуси видачі
  const claims = await prisma.prizeClaim.findMany({
    where: { campaignId },
    orderBy: { createdAt: 'desc' },
    include: { user: true, prize: true, store: { include: { city: true } } },
  });

  const claimsSheet = workbook.addWorksheet('Призи');
  claimsSheet.columns = [
    { header: '№', key: 'n', width: 6 },
    { header: 'Приз', key: 'prize', width: 24 },
    { header: 'ПІБ', key: 'name', width: 32 },
    { header: 'Телефон', key: 'phone', width: 20 },
    { header: 'Статус', key: 'status', width: 24 },
    { header: 'Джерело', key: 'source', width: 14 },
    { header: 'Місто', key: 'city', width: 16 },
    { header: 'Магазин', key: 'store', width: 26 },
    { header: 'Адреса', key: 'address', width: 32 },
    { header: 'Створено', key: 'created', width: 20 },
    { header: 'Видано', key: 'delivered', width: 20 },
  ];

  claims.forEach((c, i) => {
    claimsSheet.addRow({
      n: i + 1,
      prize: c.prize.title,
      name: c.user.fullName ?? '',
      phone: c.user.phone ? formatPhone(c.user.phone) : '',
      status: CLAIM_STATUS_UA[c.status] ?? c.status,
      source: c.source === 'DRAW' ? 'розіграш' : 'за кодами',
      city: c.store?.city.name ?? '',
      store: c.store?.name ?? '',
      address: c.store?.address ?? '',
      created: dt(c.createdAt),
      delivered: c.deliveredAt ? dt(c.deliveredAt) : '',
    });
  });
  styleHeader(claimsSheet);

  // ── Підсумки
  const [codesTotal, codesUsed, prizes] = await Promise.all([
    prisma.code.count({ where: { campaignId } }),
    prisma.code.count({ where: { campaignId, isUsed: true } }),
    prisma.prize.findMany({ where: { campaignId }, orderBy: { sortOrder: 'asc' } }),
  ]);

  const summary = workbook.addWorksheet('Підсумки');
  summary.columns = [
    { header: 'Показник', key: 'k', width: 34 },
    { header: 'Значення', key: 'v', width: 24 },
  ];

  summary.addRows([
    { k: 'Кампанія', v: campaign.title },
    { k: 'Статус', v: campaign.status },
    { k: 'Учасників', v: participants.length },
    { k: 'Активацій (квитків у розіграш)', v: activations.length },
    { k: 'Кодів усього', v: codesTotal },
    { k: 'Кодів використано', v: codesUsed },
    {
      k: 'Кодів залишилось',
      v: codesTotal - codesUsed,
    },
    { k: '', v: '' },
  ]);

  for (const prize of prizes) {
    summary.addRow({
      k: `${prize.title}: видано / резерв / запас`,
      v: `${prize.issued} / ${prize.reserved} / ${prize.stock ?? '∞'}`,
    });
  }

  summary.addRow({ k: '', v: '' });
  summary.addRow({ k: 'Вигрузка сформована', v: dt(new Date()) });
  styleHeader(summary);

  return workbook;
}