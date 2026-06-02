import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

interface ButtonLinkProps extends VariantProps<typeof buttonVariants> {
  href: string
  className?: string
  children: React.ReactNode
}

export function ButtonLink({ href, className, variant = "default", size = "default", children }: ButtonLinkProps) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant, size, className }))}>
      {children}
    </Link>
  )
}
