import { lazy } from "react";
import { Route, Routes } from "react-router-dom";

const HomeOverviewPage = lazy(() => import("./pages/overview"));
const MyWorkPage = lazy(() => import("./pages/my-work"));
const FavoritesPage = lazy(() => import("./pages/favorites"));

/** /home/* (app/mockups/modules/00-home). No key to open; every widget checks its module's read key. */
export default function HomeRoutes() {
    return (
        <Routes>
            <Route index element={<HomeOverviewPage />} />
            <Route path="my-work" element={<MyWorkPage />} />
            <Route path="favorites" element={<FavoritesPage />} />
            <Route path="recent" element={<FavoritesPage />} />
            <Route path="*" element={<HomeOverviewPage />} />
        </Routes>
    );
}
