'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ChartData {
  name: string;
  Pemasukan: number;
  Pengeluaran: number;
}

export default function FinanceChart({ data }: { data: ChartData[] }) {
  if (!data || data.length === 0) {
    return <div className="text-secondary flex justify-center items-center h-full">Belum ada data transaksi</div>;
  }

  const formatRupiah = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      notation: 'compact',
      compactDisplay: 'short',
    }).format(value);
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dad9e5" />
        <XAxis 
          dataKey="name" 
          axisLine={false} 
          tickLine={false} 
          tick={{ fontSize: 12, fill: '#757686' }} 
          dy={10}
        />
        <YAxis 
          axisLine={false} 
          tickLine={false} 
          tickFormatter={formatRupiah} 
          tick={{ fontSize: 12, fill: '#757686' }}
        />
        <Tooltip 
          cursor={{ fill: '#eeecf9' }}
          contentStyle={{ 
            backgroundColor: '#ffffff', 
            border: '1px solid #e3e1ed',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(24,26,42,0.06)'
          }}
          formatter={(value: any) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(value) || 0)}
        />
        <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
        <Bar dataKey="Pemasukan" fill="#33B679" radius={[4, 4, 0, 0]} maxBarSize={40} />
        <Bar dataKey="Pengeluaran" fill="#F5924B" radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}
