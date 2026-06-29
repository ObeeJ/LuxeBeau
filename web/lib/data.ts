/* Demo fixtures for the seller / artisan / admin dashboards.

   The product & artisan CATALOGUE is no longer here: it lives in the Go API and
   is fetched through lib/queries (useProducts / useArtisans). What remains below
   powers the seller, artisan and admin studio views, which do not yet have
   backend list endpoints. These views render a clearly-labelled "Sample data"
   badge so the demo content is never mistaken for live figures.

   All people and figures are fictional. Prices in NGN. Dates ISO YYYY-MM-DD. */

export interface OrderRow {
  id: string;
  customer: string;
  items: string;
  totalNGN: number;
  status: "Paid" | "Shipped" | "Delivered" | "Refunded";
  date: string;
}

export interface BookingRow {
  id: string;
  client: string;
  service: string;
  date: string;
  time: string;
  priceNGN: number;
  status: "Confirmed" | "Pending" | "Completed" | "Cancelled";
}

export const sellerOrders: OrderRow[] = [
  { id: "LB-10241", customer: "Funmi A.", items: "Ọsẹ Dúdú Bar ×2, Hibiscus Toner", totalNGN: 28500, status: "Paid", date: "2026-06-12" },
  { id: "LB-10240", customer: "Emeka O.", items: "Sahel Amber Oud", totalNGN: 38000, status: "Shipped", date: "2026-06-11" },
  { id: "LB-10238", customer: "Hauwa B.", items: "Chebé Hair Butter ×3", totalNGN: 36000, status: "Delivered", date: "2026-06-10" },
  { id: "LB-10235", customer: "Tope S.", items: "Shea Silk Crème, Owambe Lipstick", totalNGN: 18800, status: "Delivered", date: "2026-06-09" },
  { id: "LB-10231", customer: "Adaeze N.", items: "Hibiscus Toner", totalNGN: 11500, status: "Refunded", date: "2026-06-07" },
];

export const artisanBookings: BookingRow[] = [
  { id: "BK-5521", client: "Kemi L.", service: "Knotless Braids (Mid-back)", date: "2026-06-14", time: "9:00 AM", priceNGN: 45000, status: "Confirmed" },
  { id: "BK-5520", client: "Sandra E.", service: "Bohemian Twists", date: "2026-06-14", time: "2:00 PM", priceNGN: 55000, status: "Pending" },
  { id: "BK-5518", client: "Bisi O.", service: "Cornrow Crown", date: "2026-06-13", time: "11:00 AM", priceNGN: 25000, status: "Completed" },
  { id: "BK-5515", client: "Amina Y.", service: "Knotless Braids (Mid-back)", date: "2026-06-12", time: "10:00 AM", priceNGN: 45000, status: "Completed" },
  { id: "BK-5511", client: "Joy U.", service: "Bohemian Twists", date: "2026-06-11", time: "8:00 AM", priceNGN: 55000, status: "Cancelled" },
];

export const weeklyRevenue = [
  { day: "Mon", productNGN: 86000, serviceNGN: 120000 },
  { day: "Tue", productNGN: 64000, serviceNGN: 95000 },
  { day: "Wed", productNGN: 112000, serviceNGN: 140000 },
  { day: "Thu", productNGN: 98000, serviceNGN: 180000 },
  { day: "Fri", productNGN: 175000, serviceNGN: 260000 },
  { day: "Sat", productNGN: 240000, serviceNGN: 410000 },
  { day: "Sun", productNGN: 132000, serviceNGN: 150000 },
];

export const adminQueue = [
  { id: "V-301", name: "Halima Yusuf", type: "Artisan, Lash Tech", city: "Kano", submitted: "2026-06-11", status: "Awaiting review" },
  { id: "V-300", name: "Ébí Naturals", type: "Seller, Skincare", city: "Port Harcourt", submitted: "2026-06-10", status: "Docs requested" },
  { id: "V-298", name: "Damilare Cuts", type: "Artisan, Barber", city: "Ibadan", submitted: "2026-06-09", status: "Awaiting review" },
  { id: "V-296", name: "Òrékélèwà Cosmetics", type: "Seller, Makeup", city: "Lagos", submitted: "2026-06-08", status: "Approved" },
];
