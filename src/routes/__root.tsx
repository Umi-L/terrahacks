import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import "../index.css";
import { ThemeProvider } from '../theme/theme-provider';
import { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuLink } from "@/components/ui/navigation-menu";

export const Route = createRootRoute({
    component: () => (
        <ThemeProvider>
            <Outlet />
        </ThemeProvider>
    ),
})