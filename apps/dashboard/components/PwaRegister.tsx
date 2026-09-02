'use client';

import { useEffect } from 'react';

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('PWA Service Worker active with scope:', registration.scope);
        })
        .catch((error) => {
          if (process.env.NODE_ENV === 'production') {
            console.warn('PWA Service Worker registration warning:', error);
          }
        });
    }
  }, []);

  return null;
}
