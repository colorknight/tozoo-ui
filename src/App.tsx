import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout } from "@/layouts/AdminLayout";
import { DialogProvider } from "@/components/DialogProvider";
import { CouponManagePage } from "@/pages/CouponManagePage";
import { HomePage } from "@/pages/HomePage";
import { ProductDetailPage } from "@/pages/ProductDetailPage";
import { PromotionManagePage } from "@/pages/PromotionManagePage";

export default function App() {
  return (
    <DialogProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AdminLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/product/:id" element={<ProductDetailPage />} />
            <Route path="/promotions" element={<PromotionManagePage />} />
            <Route path="/coupons" element={<CouponManagePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </DialogProvider>
  );
}
