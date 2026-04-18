import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'

export default function LandingPage() {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold">POS UMKM</h1>
      <p className="text-muted-foreground text-center max-w-sm">
        Sistem kasir untuk usaha kecil Indonesia
      </p>
      <Button onClick={() => navigate('/login')}>Masuk</Button>
    </div>
  )
}

