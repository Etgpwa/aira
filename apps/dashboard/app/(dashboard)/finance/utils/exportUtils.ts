import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatInTimeZone } from 'date-fns-tz';

const MONTH_NAMES = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export interface TransactionItem {
    id: string;
    amount: number;
    currency?: string;
    type: 'income' | 'expense';
    description?: string | null;
    transaction_date: string;
    created_at?: string;
    account_id?: string;
    category_id?: string;
    bank_accounts?: { id: string; name: string } | { id: string; name: string }[];
    transaction_categories?: { id: string; name: string } | { id: string; name: string }[];
}

export interface RecapExportData {
    month: number;
    year: number;
    accountName?: string;
    transactions: TransactionItem[];
    userEmail?: string;
    userSettings?: { phone_number?: string; timezone?: string } | null;
}

const formatIDR = (num: number): string => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(num);
};

const getAccountName = (tx: TransactionItem): string => {
    if (!tx.bank_accounts) return '-';
    if (Array.isArray(tx.bank_accounts)) {
        return tx.bank_accounts[0]?.name || '-';
    }
    return tx.bank_accounts.name || '-';
};

const getCategoryName = (tx: TransactionItem): string => {
    if (!tx.transaction_categories) return 'Tanpa Kategori';
    if (Array.isArray(tx.transaction_categories)) {
        return tx.transaction_categories[0]?.name || 'Tanpa Kategori';
    }
    return tx.transaction_categories.name || 'Tanpa Kategori';
};

// ────────────────────────────────────────────────────────────────
// 1. GENERATE EXCEL REKAP BULANAN (.XLSX)
// ────────────────────────────────────────────────────────────────
export async function generateFinanceExcel(data: RecapExportData): Promise<void> {
    const { month, year, accountName = 'Semua Rekening', transactions } = data;
    const monthName = MONTH_NAMES[month - 1];
    const timeZone = data.userSettings?.timezone || 'Asia/Jakarta';

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Asisten Pribadi (Karen)';
    workbook.created = new Date();

    // ── Hitung Metrik ──
    let totalIncome = 0;
    let totalExpense = 0;
    const categoryExpenseMap: { [cat: string]: number } = {};
    const categoryIncomeMap: { [cat: string]: number } = {};

    transactions.forEach(tx => {
        const amt = Number(tx.amount || 0);
        const cat = getCategoryName(tx);
        if (tx.type === 'income') {
            totalIncome += amt;
            categoryIncomeMap[cat] = (categoryIncomeMap[cat] || 0) + amt;
        } else {
            totalExpense += amt;
            categoryExpenseMap[cat] = (categoryExpenseMap[cat] || 0) + amt;
        }
    });

    const netCashflow = totalIncome - totalExpense;

    // ───────────────────────────────────────
    // SHEET 1: RINGKASAN
    // ───────────────────────────────────────
    const summarySheet = workbook.addWorksheet('Ringkasan');
    summarySheet.views = [{ showGridLines: true }];

    // Judul
    summarySheet.mergeCells('A1:E1');
    const titleCell = summarySheet.getCell('A1');
    titleCell.value = `REKAPITULASI KEUANGAN BULANAN - ${monthName.toUpperCase()} ${year}`;
    titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    summarySheet.getRow(1).height = 35;

    // Subtitle / Info
    summarySheet.getCell('A3').value = 'Filter Rekening:';
    summarySheet.getCell('B3').value = accountName;
    summarySheet.getCell('A4').value = 'Tanggal Dicetak:';
    summarySheet.getCell('B4').value = formatInTimeZone(new Date(), timeZone, 'dd MMMM yyyy HH:mm zzz');
    summarySheet.getCell('A5').value = 'Jumlah Transaksi:';
    summarySheet.getCell('B5').value = `${transactions.length} transaksi`;

    ['A3', 'A4', 'A5'].forEach(cell => {
        summarySheet.getCell(cell).font = { bold: true, color: { argb: 'FF475569' } };
    });

    // Box Metrik Utama
    summarySheet.mergeCells('A7:B7');
    summarySheet.getCell('A7').value = 'Total Pemasukan';
    summarySheet.getCell('A7').font = { bold: true, color: { argb: 'FF166534' } };
    summarySheet.mergeCells('A8:B8');
    summarySheet.getCell('A8').value = totalIncome;
    summarySheet.getCell('A8').numFmt = '"Rp "#,##0';
    summarySheet.getCell('A8').font = { size: 14, bold: true, color: { argb: 'FF16A34A' } };

    summarySheet.mergeCells('C7:D7');
    summarySheet.getCell('C7').value = 'Total Pengeluaran';
    summarySheet.getCell('C7').font = { bold: true, color: { argb: 'FF991B1B' } };
    summarySheet.mergeCells('C8:D8');
    summarySheet.getCell('C8').value = totalExpense;
    summarySheet.getCell('C8').numFmt = '"Rp "#,##0';
    summarySheet.getCell('C8').font = { size: 14, bold: true, color: { argb: 'FFDC2626' } };

    summarySheet.mergeCells('E7:F7');
    summarySheet.getCell('E7').value = 'Arus Kas Bersih (Net)';
    summarySheet.getCell('E7').font = { bold: true, color: { argb: 'FF1E40AF' } };
    summarySheet.mergeCells('E8:F8');
    summarySheet.getCell('E8').value = netCashflow;
    summarySheet.getCell('E8').numFmt = '"Rp "#,##0';
    summarySheet.getCell('E8').font = { size: 14, bold: true, color: { argb: netCashflow >= 0 ? 'FF2563EB' : 'FFDC2626' } };

    // Tabel Breakdown Pengeluaran per Kategori
    summarySheet.getCell('A11').value = 'PENGELUARAN PER KATEGORI';
    summarySheet.getCell('A11').font = { bold: true, color: { argb: 'FF1E293B' }, size: 12 };
    
    summarySheet.getCell('A12').value = 'Kategori';
    summarySheet.getCell('B12').value = 'Total Pengeluaran';
    summarySheet.getCell('C12').value = 'Proporsi (%)';
    ['A12', 'B12', 'C12'].forEach(c => {
        const cell = summarySheet.getCell(c);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        cell.font = { bold: true };
    });

    let rowIdx = 13;
    const sortedExpenseCats = Object.entries(categoryExpenseMap).sort((a, b) => b[1] - a[1]);
    sortedExpenseCats.forEach(([cat, amt]) => {
        summarySheet.getCell(`A${rowIdx}`).value = cat;
        summarySheet.getCell(`B${rowIdx}`).value = amt;
        summarySheet.getCell(`B${rowIdx}`).numFmt = '"Rp "#,##0';
        summarySheet.getCell(`C${rowIdx}`).value = totalExpense > 0 ? amt / totalExpense : 0;
        summarySheet.getCell(`C${rowIdx}`).numFmt = '0.0%';
        rowIdx++;
    });

    summarySheet.getColumn(1).width = 25;
    summarySheet.getColumn(2).width = 22;
    summarySheet.getColumn(3).width = 16;
    summarySheet.getColumn(4).width = 22;
    summarySheet.getColumn(5).width = 22;
    summarySheet.getColumn(6).width = 22;

    // ───────────────────────────────────────
    // SHEET 2: JURNAL TRANSAKSI LENGKAP
    // ───────────────────────────────────────
    const journalSheet = workbook.addWorksheet('Jurnal Transaksi');
    journalSheet.views = [{ showGridLines: true }];

    // Header Jurnal
    const journalHeaders = [
        'No', 'Tanggal', 'Waktu', 'Keterangan / Deskripsi', 
        'Rekening / Dompet', 'Kategori', 'Debit (Pemasukan)', 'Kredit (Pengeluaran)', 'Saldo Berjalan'
    ];
    
    const headerRow = journalSheet.addRow(journalHeaders);
    headerRow.height = 26;
    headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        cell.font = { name: 'Segoe UI', bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    let runningBalance = 0;
    transactions.forEach((tx, idx) => {
        const amt = Number(tx.amount || 0);
        const isIncome = tx.type === 'income';
        const debit = isIncome ? amt : 0;
        const credit = !isIncome ? amt : 0;
        runningBalance += isIncome ? amt : -amt;

        const dateStr = formatInTimeZone(new Date(tx.transaction_date), timeZone, 'dd/MM/yyyy');
        const timeStr = formatInTimeZone(new Date(tx.transaction_date), timeZone, 'HH:mm');

        const row = journalSheet.addRow([
            idx + 1,
            dateStr,
            timeStr,
            tx.description || (isIncome ? 'Pemasukan' : 'Pengeluaran'),
            getAccountName(tx),
            getCategoryName(tx),
            debit,
            credit,
            runningBalance
        ]);

        // Styling row
        row.getCell(1).alignment = { horizontal: 'center' };
        row.getCell(2).alignment = { horizontal: 'center' };
        row.getCell(3).alignment = { horizontal: 'center' };
        row.getCell(7).numFmt = '"Rp "#,##0';
        row.getCell(8).numFmt = '"Rp "#,##0';
        row.getCell(9).numFmt = '"Rp "#,##0';

        if (isIncome) {
            row.getCell(7).font = { color: { argb: 'FF16A34A' }, bold: true };
        } else {
            row.getCell(8).font = { color: { argb: 'FFDC2626' } };
        }
    });

    // Baris Total Jurnal
    if (transactions.length > 0) {
        const lastRowIndex = transactions.length + 1;
        const totalRow = journalSheet.addRow([
            '', '', '', 'TOTAL ARUS KAS', '', '',
            { formula: `SUM(G2:G${lastRowIndex})` },
            { formula: `SUM(H2:H${lastRowIndex})` },
            runningBalance
        ]);
        totalRow.height = 24;
        totalRow.font = { bold: true };
        totalRow.getCell(4).alignment = { horizontal: 'right' };
        totalRow.getCell(7).numFmt = '"Rp "#,##0';
        totalRow.getCell(8).numFmt = '"Rp "#,##0';
        totalRow.getCell(9).numFmt = '"Rp "#,##0';
        totalRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        });
    }

    journalSheet.columns = [
        { width: 6 },   // No
        { width: 14 },  // Tanggal
        { width: 10 },  // Jam
        { width: 32 },  // Keterangan
        { width: 18 },  // Rekening
        { width: 20 },  // Kategori
        { width: 20 },  // Debit
        { width: 20 },  // Kredit
        { width: 22 },  // Saldo Berjalan
    ];

    // Simpan dan unduh file di browser
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rekap_Keuangan_${monthName}_${year}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ────────────────────────────────────────────────────────────────
// 2. GENERATE PDF BENTUK JURNAL KEUANGAN
// ────────────────────────────────────────────────────────────────
export function generateFinanceJournalPDF(data: RecapExportData): void {
    const { month, year, accountName = 'Semua Rekening', transactions } = data;
    const monthName = MONTH_NAMES[month - 1];
    const timeZone = data.userSettings?.timezone || 'Asia/Jakarta';

    // Orientasi Landscape untuk tabel jurnal multi-kolom yang luas
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // ── Header Kop Dokumen ──
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.rect(0, 0, pageWidth, 28, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('JURNAL ARUS KAS & KEUANGAN BULANAN', 14, 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(203, 213, 225); // Slate 300
    doc.text(`Periode: ${monthName.toUpperCase()} ${year}  |  Rekening: ${accountName}`, 14, 19);
    doc.text(`Dicetak: ${formatInTimeZone(new Date(), timeZone, 'dd/MM/yyyy HH:mm')} WIB`, 14, 24);

    // ── Hitung Metrik ──
    let totalIncome = 0;
    let totalExpense = 0;
    transactions.forEach(tx => {
        const amt = Number(tx.amount || 0);
        if (tx.type === 'income') totalIncome += amt;
        else totalExpense += amt;
    });
    const netCashflow = totalIncome - totalExpense;

    // ── Box Ringkasan Kinerja (3 Kotak) ──
    const startY = 34;
    const boxWidth = (pageWidth - 28 - 12) / 3;
    const boxHeight = 16;

    // 1. Pemasukan
    doc.setFillColor(240, 253, 244); // Green 50
    doc.setDrawColor(187, 247, 208); // Green 200
    doc.roundedRect(14, startY, boxWidth, boxHeight, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(22, 101, 52); // Green 800
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL PEMASUKAN', 18, startY + 5);
    doc.setFontSize(11);
    doc.setTextColor(21, 128, 61); // Green 700
    doc.text(formatIDR(totalIncome), 18, startY + 12);

    // 2. Pengeluaran
    const box2X = 14 + boxWidth + 6;
    doc.setFillColor(254, 242, 242); // Red 50
    doc.setDrawColor(254, 202, 202); // Red 200
    doc.roundedRect(box2X, startY, boxWidth, boxHeight, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(153, 27, 27); // Red 800
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL PENGELUARAN', box2X + 4, startY + 5);
    doc.setFontSize(11);
    doc.setTextColor(185, 28, 28); // Red 700
    doc.text(formatIDR(totalExpense), box2X + 4, startY + 12);

    // 3. Arus Kas Bersih (Net)
    const box3X = box2X + boxWidth + 6;
    doc.setFillColor(239, 246, 255); // Blue 50
    doc.setDrawColor(191, 219, 254); // Blue 200
    doc.roundedRect(box3X, startY, boxWidth, boxHeight, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(30, 64, 175); // Blue 800
    doc.setFont('helvetica', 'bold');
    doc.text('ARUS KAS BERSIH (SURPLUS / DEFISIT)', box3X + 4, startY + 5);
    doc.setFontSize(11);
    doc.setTextColor(netCashflow >= 0 ? 37 : 185, netCashflow >= 0 ? 99 : 28, netCashflow >= 0 ? 235 : 28);
    doc.text(formatIDR(netCashflow), box3X + 4, startY + 12);

    // ── Tabel Jurnal Akuntansi ──
    let runningBalance = 0;
    const tableBody = transactions.map((tx, idx) => {
        const amt = Number(tx.amount || 0);
        const isIncome = tx.type === 'income';
        const debit = isIncome ? formatIDR(amt) : '-';
        const credit = !isIncome ? formatIDR(amt) : '-';
        runningBalance += isIncome ? amt : -amt;

        const dateFormatted = formatInTimeZone(new Date(tx.transaction_date), timeZone, 'dd/MM/yy HH:mm');

        return [
            (idx + 1).toString(),
            dateFormatted,
            tx.description || (isIncome ? 'Pemasukan' : 'Pengeluaran'),
            getAccountName(tx),
            getCategoryName(tx),
            debit,
            credit,
            formatIDR(runningBalance)
        ];
    });

    // Baris Total di akhir tabel
    tableBody.push([
        '',
        '',
        'TOTAL PERIODE INI',
        '',
        '',
        formatIDR(totalIncome),
        formatIDR(totalExpense),
        formatIDR(runningBalance)
    ]);

    autoTable(doc, {
        startY: 55,
        head: [['No', 'Tanggal/Waktu', 'Uraian / Keterangan', 'Rekening', 'Kategori', 'Debit (Masuk)', 'Kredit (Keluar)', 'Saldo Berjalan']],
        body: tableBody,
        theme: 'grid',
        styles: {
            fontSize: 8.5,
            font: 'helvetica',
            cellPadding: 2.5,
            lineColor: [226, 232, 240],
            lineWidth: 0.2
        },
        headStyles: {
            fillColor: [30, 41, 59],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center'
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            1: { halign: 'center', cellWidth: 26 },
            2: { halign: 'left', cellWidth: 'auto' },
            3: { halign: 'left', cellWidth: 28 },
            4: { halign: 'left', cellWidth: 28 },
            5: { halign: 'right', cellWidth: 32, textColor: [21, 128, 61] },
            6: { halign: 'right', cellWidth: 32, textColor: [185, 28, 28] },
            7: { halign: 'right', cellWidth: 34, fontStyle: 'bold' }
        },
        didParseCell: (hookData) => {
            // Highlight baris total
            if (hookData.row.index === tableBody.length - 1) {
                hookData.cell.styles.fillColor = [241, 245, 249];
                hookData.cell.styles.fontStyle = 'bold';
            }
        },
        didDrawPage: (hookData) => {
            // Footer nomor halaman di tiap lembar
            const str = `Halaman ${hookData.pageNumber} | Asisten Pribadi (Karen) Finance Journal`;
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184); // Slate 400
            doc.text(str, pageWidth - 14, pageHeight - 8, { align: 'right' });
        }
    });

    doc.save(`Jurnal_Keuangan_${monthName}_${year}.pdf`);
}
