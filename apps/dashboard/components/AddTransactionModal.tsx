'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import Modal from './Modal';
import { createClient } from '@/lib/supabase/client';

// Supabase client will be created inside the component

export default function AddTransactionModal({ userId, accounts, categories }: { userId: string, accounts: any[], categories: any[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const [formData, setFormData] = useState({
    type: 'expense',
    amount: '',
    description: '',
    account_id: accounts[0]?.id || '',
    category_id: categories.filter(c => c.type === 'expense')[0]?.id || ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase.from('transactions').insert({
        user_id: userId,
        account_id: formData.account_id,
        category_id: formData.category_id,
        amount: Number(formData.amount),
        type: formData.type,
        description: formData.description,
        transaction_date: new Date().toISOString()
      });

      if (!error) {
        // Also update account balance
        const acc = accounts.find(a => a.id === formData.account_id);
        if (acc) {
          const newBalance = formData.type === 'expense' 
            ? Number(acc.balance) - Number(formData.amount)
            : Number(acc.balance) + Number(formData.amount);
            
          await supabase.from('bank_accounts')
            .update({ balance: newBalance })
            .eq('id', formData.account_id);
        }

        setIsOpen(false);
        setFormData({ ...formData, amount: '', description: '' });
        router.refresh();
      } else {
        console.error(error);
        alert('Gagal menyimpan transaksi');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTypeChange = (type: string) => {
    const firstCat = categories.filter(c => c.type === type)[0]?.id || '';
    setFormData({ ...formData, type, category_id: firstCat });
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="btn btn-primary">
        <Plus size={16} className="mr-2" style={{ marginRight: '0.5rem' }} />
        Catat Transaksi
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Catat Transaksi">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Jenis Transaksi</label>
            <div className="flex gap-2">
              <label className="flex-1">
                <input 
                  type="radio" 
                  name="type" 
                  value="expense" 
                  checked={formData.type === 'expense'} 
                  onChange={() => handleTypeChange('expense')} 
                  style={{ marginRight: '0.5rem' }}
                /> 
                Pengeluaran
              </label>
              <label className="flex-1">
                <input 
                  type="radio" 
                  name="type" 
                  value="income" 
                  checked={formData.type === 'income'} 
                  onChange={() => handleTypeChange('income')} 
                  style={{ marginRight: '0.5rem' }}
                /> 
                Pemasukan
              </label>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="amount">Nominal (Rp)</label>
            <input 
              type="number" 
              id="amount" 
              required 
              min="0"
              className="form-input" 
              value={formData.amount} 
              onChange={e => setFormData({ ...formData, amount: e.target.value })} 
              placeholder="Contoh: 50000"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="description">Deskripsi</label>
            <input 
              type="text" 
              id="description" 
              required 
              className="form-input" 
              value={formData.description} 
              onChange={e => setFormData({ ...formData, description: e.target.value })} 
              placeholder="Makan siang..."
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="account">Rekening/Dompet</label>
            <select 
              id="account" 
              className="form-select"
              value={formData.account_id}
              onChange={e => setFormData({ ...formData, account_id: e.target.value })}
            >
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label className="form-label" htmlFor="category">Kategori</label>
            <select 
              id="category" 
              className="form-select"
              value={formData.category_id}
              onChange={e => setFormData({ ...formData, category_id: e.target.value })}
            >
              {categories.filter(c => c.type === formData.type).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="form-actions">
            <button type="button" onClick={() => setIsOpen(false)} className="btn btn-outline">Batal</button>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary">
              {isSubmitting ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
