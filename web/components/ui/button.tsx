import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/* Every control is a 9999px pill. Primary actions are ink-filled; violet is
   reserved for the search submit and the wordmark. */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-[16px] tracking-[-0.031em] whitespace-nowrap transition-[background-color,box-shadow,opacity] duration-200 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-ink text-surface hover:bg-slate",
        outline: "border border-hairline bg-surface text-ink shadow-pill hover:shadow-card",
        secondary: "bg-canvas text-ink hover:bg-hairline",
        ghost: "text-ink hover:bg-canvas",
        destructive: "border border-ink bg-surface text-ink hover:bg-canvas",
        link: "text-ink underline underline-offset-4",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 px-4 text-[14px] tracking-[-0.014em]",
        lg: "h-12 px-6",
        icon: "size-11",
        "icon-sm": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
