"use client";

import { LogOut, User as UserIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  email: string;
  roleLabel: string;
}

/**
 * Topbar-right user dropdown. Shows email + role + sign-out.
 * Sign-out is a form POST so it survives JS being disabled and
 * dodges CSRF replay on GET.
 */
export function UserMenu({ email, roleLabel }: Props) {
  const initials = email.slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar className="size-8">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm truncate">{email}</span>
            <span className="text-xs text-muted-foreground">
              {roleLabel}
            </span>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem disabled className="text-muted-foreground">
          <UserIcon className="size-4 mr-2" />
          账号设置（待开发）
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <form action="/api/auth/sign-out" method="post">
          <button
            type="submit"
            className="flex w-full items-center px-2 py-1.5 text-sm rounded-sm hover:bg-accent text-destructive"
          >
            <LogOut className="size-4 mr-2" />
            退出登录
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
