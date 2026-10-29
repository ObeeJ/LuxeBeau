import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/* Every control is a 9999px pill with press feedback (scale .96, opacity .6
   over .15s). Primary actions are brand purple with a soft glow. Default
   height is 44px; smaller sizes extend their hit area to 44px. */
const buttonVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-[15px] font-semibold tracking-[-0.02em] whitespace-nowrap transition-[background-color,box-shadow,opacity,transform] duration-150 ease-in-out outline-none select-none active:scale-[.96] active:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-brand text-surface shadow-glow hover:bg-brand-deep",
        secondary: "bg-surface text-ink shadow-soft hover:shadow-float",
        dark: "bg-ink text-surface hover:bg-slate",
        outline: "border border-hairline bg-surface text-ink shadow-pill hover:shadow-card",
        ghost: "text-ink hover:bg-canvas",
        destructive: "border border-ink bg-surface text-ink hover:bg-canvas",
        link: "text-brand underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 px-4 text-[14px] tracking-[-0.014em] after:absolute after:-inset-1 after:content-['']",
        lg: "h-12 px-6 text-[16px]",
        icon: "size-11",
        "icon-sm": "size-9 after:absolute after:-inset-1 after:content-['']",
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
