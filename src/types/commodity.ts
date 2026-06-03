/** 与 OpenAPI `CommodityVo` 对齐 */
export interface CommodityVo {
  id: string;
  name: string;
  alias?: string;
  backtracking?: string;
  computionFramework?: string;
  currency?: string;
  description?: string;
  /** 小 SVG 等；列表/详情与 GET /portrait/{id} 一致（非 sengee 算子为 sengee 同源） */
  portrait?: string;
  enable?: boolean;
  commodityStatus?: "UPPER" | "DOWN" | string;
  commodityType?: string;
  price: number;
  publishTime?: string;
  url?: string;
  vendorId?: string;
  version?: string;
}

/** Spring Data Page«CommodityVo» */
export interface PageCommodityVo {
  content: CommodityVo[];
  empty: boolean;
  first: boolean;
  last: boolean;
  number: number;
  numberOfElements?: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
