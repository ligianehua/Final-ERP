import { NavLinks } from "./nav-links"

export function Sidebar() {
  return (
    <aside className="w-56 border-r border-border bg-background hidden md:flex flex-col">
      <NavLinks />
    </aside>
  )
}
