import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn("lb-input min-h-24", className)}
      {...props}
    />
  )
}

export { Textarea }
