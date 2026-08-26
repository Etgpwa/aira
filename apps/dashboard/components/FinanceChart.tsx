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
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
        <XAxis 
          dataKey="name" 
          axisLine={false} 
          tickLine={false} 
          tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} 
          dy={10}
        />
        <YAxis 
          axisLine={false} 
          tickLine={false} 
          tickFormatter={formatRupiah} 
          tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
        />
        <Tooltip 
          cursor={{ fill: 'var(--bg-secondary)' }}
          contentStyle={{ 
            backgroundColor: 'var(--bg-primary)', 
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            boxShadow: 'var(--card-shadow)'
          }}
          formatter={(value: any) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(value) || 0)}
        />
        <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
        <Bar dataKey="Pemasukan" fill="var(--success)" radius={[4, 4, 0, 0]} maxBarSize={40} />
        <Bar dataKey="Pengeluaran" fill="var(--danger)" radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}
