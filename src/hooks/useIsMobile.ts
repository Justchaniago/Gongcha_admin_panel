import { useState, useEffect } from 'react';

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Deteksi jika lebar layar kurang dari 768px (ukuran tablet/HP)
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    
    // Cek saat pertama kali load
    checkMobile();
    
    // Update jika ukuran browser diubah
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}