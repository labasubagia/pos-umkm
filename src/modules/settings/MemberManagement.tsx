/**
 * MemberManagement — UI for inviting, listing, and revoking store members.
 *
 * Data comes from useMembers() (React Query). Mutations invalidate the query.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { MEMBERS_QUERY_KEY, useMembers } from "../../hooks/useMembers";
import { useAuthStore } from "../../store/authStore";
import { getStoreMapStore } from "../../store/storeMapStore";
import {
  generateStoreLink,
  inviteMember,
  revokeMember,
} from "./members.service";

export function MemberManagement() {
  const activeStoreId = useAuthStore((s) => s.activeStoreId);
  const queryClient = useQueryClient();
  const { data: members = [], isLoading } = useMembers();

  // Master spreadsheet ID from the store map (used for invite + store link)
  const spreadsheetId = (() => {
    try {
      if (!activeStoreId) return null;
      return (
        getStoreMapStore(activeStoreId).getState().sheets.Members
          ?.spreadsheet_id ?? null
      );
    } catch {
      return null;
    }
  })();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"manager" | "cashier">("cashier");
  const [storeLink, setStoreLink] = useState<string | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: MEMBERS_QUERY_KEY(activeStoreId),
    });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!spreadsheetId) throw new Error("No spreadsheet ID");
      await inviteMember(email, role, spreadsheetId);
      setStoreLink(generateStoreLink(spreadsheetId));
      setEmail("");
      await invalidate();
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (userId: string) => revokeMember(userId),
    onSuccess: () => void invalidate(),
  });

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    inviteMutation.mutate();
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
            onChange={(e) => setRole(e.target.value as "manager" | "cashier")}
          >
            <option value="cashier">Kasir</option>
            <option value="manager">Manajer</option>
          </select>
        </div>
        {inviteMutation.isError && (
          <Alert variant="destructive">
            <AlertDescription>{String(inviteMutation.error)}</AlertDescription>
          </Alert>
        )}
        <Button
          type="submit"
          disabled={inviteMutation.isPending}
          data-testid="btn-invite-member"
        >
          {inviteMutation.isPending ? "Mengundang..." : "Undang Anggota"}
        </Button>
      </form>

      {storeLink && (
        <div
          className="bg-green-50 border border-green-200 rounded p-4 max-w-sm"
          data-testid="store-link-section"
        >
          <p className="font-medium text-green-800 mb-1">Tautan Toko:</p>
          <p
            className="break-all text-sm font-mono"
            data-testid="store-link-url"
          >
            {storeLink}
          </p>
          <p className="text-xs text-green-700 mt-1">
            Bagikan tautan ini ke anggota untuk bergabung.
          </p>
        </div>
      )}

      <div>
        <h3 className="font-semibold mb-2">Daftar Anggota</h3>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Memuat anggota…</p>
        ) : members.length === 0 ? (
          <p className="text-muted-foreground text-sm">Belum ada anggota.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between border rounded p-3"
                data-testid={`member-item-${m.id}`}
              >
                <div>
                  <p className="font-medium">{m.email}</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {m.role}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => revokeMutation.mutate(m.id)}
                  data-testid={`btn-revoke-${m.id}`}
                >
                  Cabut
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
