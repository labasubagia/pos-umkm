/**
 * MemberManagement — UI for inviting, listing, and revoking store members.
 *
 * Only accessible to the store owner (role === 'owner').
 * The owner enters a member's email and selects a role; on submit the
 * member is invited and a Store Link is displayed for sharing.
 */
import { useState, useEffect } from 'react'
import { useAuth } from '../auth/useAuth'
import {
  inviteMember,
  revokeMember,
  listMembers,
  generateStoreLink,
  type Member,
} from './members.service'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Alert, AlertDescription } from '../../components/ui/alert'

export default function MemberManagement() {
  const { spreadsheetId } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'manager' | 'cashier'>('cashier')
  const [storeLink, setStoreLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void listMembers().then(setMembers)
  }, [])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!spreadsheetId) return
    setLoading(true)
    setError(null)
    setStoreLink(null)
    try {
      await inviteMember(email, role, spreadsheetId)
      setStoreLink(generateStoreLink(spreadsheetId))
      setEmail('')
      const updated = await listMembers()
      setMembers(updated)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleRevoke(userId: string) {
    await revokeMember(userId)
    const updated = await listMembers()
    setMembers(updated)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <h2 className="text-xl font-bold">Kelola Anggota</h2>

      <form onSubmit={handleInvite} className="flex flex-col gap-3 max-w-sm">
        <div className="space-y-1.5">
          <Label htmlFor="member-email">Email Anggota</Label>
          <Input
            id="member-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="anggota@gmail.com"
            required
            data-testid="input-member-email"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="member-role">Peran</Label>
          <select
            id="member-role"
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value as 'manager' | 'cashier')}
          >
            <option value="cashier">Kasir</option>
            <option value="manager">Manajer</option>
          </select>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" disabled={loading} data-testid="btn-invite-member">
          {loading ? 'Mengundang...' : 'Undang Anggota'}
        </Button>
      </form>

      {storeLink && (
        <div className="bg-green-50 border border-green-200 rounded p-4 max-w-sm" data-testid="store-link-section">
          <p className="font-medium text-green-800 mb-1">Tautan Toko:</p>
          <p className="break-all text-sm font-mono" data-testid="store-link-url">{storeLink}</p>
          <p className="text-xs text-green-700 mt-1">
            Bagikan tautan ini ke anggota untuk bergabung.
          </p>
        </div>
      )}

      <div>
        <h3 className="font-semibold mb-2">Daftar Anggota</h3>
        {members.length === 0 ? (
          <p className="text-muted-foreground text-sm">Belum ada anggota.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between border rounded p-3" data-testid={`member-item-${m.id}`}>
                <div>
                  <p className="font-medium">{m.email}</p>
                  <p className="text-sm text-muted-foreground capitalize">{m.role}</p>
                </div>
                <Button variant="destructive" onClick={() => void handleRevoke(m.id)} data-testid={`btn-revoke-${m.id}`}>
                  Cabut
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
