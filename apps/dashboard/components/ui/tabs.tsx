"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Tabs as TabsPrimitive } from "radix-ui"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-11 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

/*
 * Estilo de tab bar tipo HUD de broadcast (meta de rediseño 3): frente al
 * tab shadcn por defecto (subrayado fino de 2px, tipografía normal), este
 * trigger usa etiquetas en mayúsculas con tracking amplio, tipografía
 * `.hud-number` condensada, un objetivo táctil más alto, y un tab activo
 * marcado con una franja inferior gruesa que emite resplandor
 * (`.hud-glow-primary-sm`) en el color primario neón en vez de un simple
 * subrayado plano. El pseudo-elemento `after:` original de shadcn se
 * reutiliza como la franja de 3px, pero ahora con blur adicional
 * (`drop-shadow`) para el efecto de resplandor.
 */
function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "hud-number relative inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md border border-transparent px-4 text-xs tracking-[0.14em] whitespace-nowrap text-muted-foreground uppercase transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground/90 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "data-active:text-primary data-active:hud-text-glow dark:data-active:bg-transparent dark:data-active:text-primary",
        "after:absolute after:rounded-full after:bg-primary after:opacity-0 after:shadow-[0_0_10px_2px_var(--primary)] after:transition-opacity group-data-horizontal/tabs:after:inset-x-3 group-data-horizontal/tabs:after:bottom-0 group-data-horizontal/tabs:after:h-[3px] group-data-vertical/tabs:after:inset-y-3 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-[3px] group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
