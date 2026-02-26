"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const font = "'Plus Jakarta Sans', system-ui, sans-serif";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void; // Fungsi bawaan Next.js untuk me-refresh komponen yang error
}) {
  const router = useRouter();

  // Logging error secara diam-diam di background untuk developer
  useEffect(() => {
    console.error("Terdeteksi Kendala Kritis:", error);
  }, [error]);

  return (
    <div style={{ 
      minHeight: "100vh", 
      background: "#F4F6FB", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center", 
      fontFamily: font,
      padding: "24px"
    }}>
      <div style={{ 
        background: "#fff", 
        padding: "48px", 
        borderRadius: "24px", 
        maxWidth: "460px", 
        width: "100%", 
        textAlign: "center", 
        boxShadow: "0 20px 40px rgba(15, 17, 23, 0.05), 0 1px 3px rgba(15, 17, 23, 0.03)",
        border: "1px solid #EAECF2"
      }}>
        
        {/* Ikon Peringatan yang Estetis */}
        <div style={{ 
          width: "80px", height: "80px", 
          background: "#FFF0F2", 
          borderRadius: "24px", 
          display: "flex", alignItems: "center", justifyContent: "center", 
          margin: "0 auto 24px",
          boxShadow: "inset 0 2px 4px rgba(255,255,255,0.5)"
        }}>
          <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="#C8102E" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        {/* Copywriting yang Bersahabat (Sesuai Ide Mas Ferry) */}
        <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#0F1117", marginBottom: "12px", letterSpacing: "-.02em" }}>
          Ups! Ada Kendala Teknis
        </h1>
        <p style={{ fontSize: "14px", color: "#4A5065", lineHeight: 1.6, marginBottom: "32px", fontWeight: 500 }}>
          Jangan khawatir, ini bukan salah Anda. Kami mendeteksi adanya gangguan komunikasi dengan server pada halaman ini. 
          Silakan coba muat ulang atau kembali ke halaman utama.
        </p>

        {/* Tombol Solusi / Alur Penyelesaian */}
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button 
            onClick={() => reset()} 
            style={{ 
              flex: 1, height: "48px", borderRadius: "14px", border: "1.5px solid #EAECF2", 
              background: "#fff", color: "#4A5065", fontFamily: font, fontSize: "14px", fontWeight: 700, 
              cursor: "pointer", transition: "all .2s ease" 
            }}
            onMouseOver={(e) => e.currentTarget.style.background = "#F9FAFB"}
            onMouseOut={(e) => e.currentTarget.style.background = "#fff"}
          >
            ↻ Muat Ulang
          </button>
          <button 
            onClick={() => {
              router.push("/dashboard");
              setTimeout(() => reset(), 500); // Bersihkan error state setelah pindah
            }} 
            style={{ 
              flex: 1, height: "48px", borderRadius: "14px", border: "none", 
              background: "#4361EE", color: "#fff", fontFamily: font, fontSize: "14px", fontWeight: 700, 
              cursor: "pointer", boxShadow: "0 8px 16px rgba(67,97,238,.25)", transition: "all .2s ease" 
            }}
          >
            Kembali ke Awal
          </button>
        </div>

        {/* Kode Error untuk Developer (Disembunyikan secara visual agar rapi, tapi bisa dibaca IT) */}
        <div style={{ marginTop: "32px", paddingTop: "20px", borderTop: "1px dashed #EAECF2", textAlign: "left" }}>
          <p style={{ fontSize: "11px", color: "#9299B0", margin: 0, fontWeight: 600 }}>
            INFO UNTUK TIM IT:
          </p>
          <p style={{ fontSize: "11px", color: "#9299B0", margin: "4px 0 0", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {error.message || "Unknown Rendering/Server Error"}
          </p>
        </div>
      </div>
    </div>
  );
}