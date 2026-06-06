export const dynamic = "force-dynamic"

import { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Pencil } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { requireAdmin } from "@/lib/auth/require-admin"
import { createAdminClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"
import { UserEditForm } from "./UserEditForm"

export const metadata: Metadata = { title: "Хэрэглэгч засах — Админ" }

export default async function AdminUserEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireAdmin()
  const { id } = await params

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, phone, role")
    .eq("id", id)
    .single()

  if (!profile) notFound()

  // Имэйлийг auth.users-аас admin client-аар авах
  const admin = await createAdminClient()
  const { data: authUser } = await admin.auth.admin.getUserById(id)
  const email = authUser?.user?.email ?? "—"

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/admin/users" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Хэрэглэгч засах
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">{email}</p>
        </div>
      </div>

      <UserEditForm
        userId={profile.id}
        initial={{
          display_name: profile.display_name,
          username: profile.username,
          phone: profile.phone ?? "",
          role: profile.role,
        }}
        isSelf={profile.id === user.id}
      />
    </div>
  )
}
