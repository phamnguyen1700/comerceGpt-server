import { IProductCreatePayload, IProductCreateSkuPayload, IProductDetail, IProductResponse, IProductUpdatePayload, ISkuUpdatePayload } from "@/types/product";
import { get, post, remove, patch } from "@/util/Http";
import { IProduct } from "@/types/product";

export async function getAllProducts() {
    // Mock data cho testing
    return {
        data: [
            {
                id: 1,
                name: "Kem dưỡng ẩm cho da khô",
                skinConcerns: ["dry", "sensitive"],
                ingredients: ["water", "glycerin", "hyaluronic acid"],
                price: 250000,
                description: "Kem dưỡng ẩm chuyên sâu cho da khô và nhạy cảm"
            },
            {
                id: 2,
                name: "Sữa rửa mặt cho da dầu",
                skinConcerns: ["oily", "combination"],
                ingredients: ["water", "salicylic acid", "tea tree oil"],
                price: 180000,
                description: "Sữa rửa mặt kiểm soát dầu cho da dầu và hỗn hợp"
            },
            {
                id: 3,
                name: "Serum vitamin C",
                skinConcerns: ["normal", "combination", "dry"],
                ingredients: ["water", "vitamin c", "niacinamide"],
                price: 350000,
                description: "Serum làm sáng da và chống oxy hóa"
            },
            {
                id: 4,
                name: "Kem chống nắng SPF 50",
                skinConcerns: ["sensitive", "dry", "normal", "combination", "oily"],
                ingredients: ["zinc oxide", "titanium dioxide", "aloe vera"],
                price: 280000,
                description: "Kem chống nắng vật lý phù hợp mọi loại da"
            }
        ]
    };
}
export const getProductDetail = async (id: string) => {
    const res = await get<IProductDetail>(`/product/${id}`);
    return res.data;
};

export const uploadSkuImages = async (skuId: string, files: File[]) => {
    const formData = new FormData();
    files.forEach(file => {
        formData.append('files', file);
    });
    const res = await post(`/sku/${skuId}/images/add`, formData, {
        headers: { 
            'Content-Type': 'multipart/form-data',
            'Accept': "*/*"
        }
    });
    return res.data;
};

export const replaceSkuImage = async (skuId: string, imageIndex: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await post(`/sku/${skuId}/images/${imageIndex}`, formData, {
        method: 'PATCH',
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
};

export const deletedSkuImages = async (skuId: string, imageIndex: number) => {
    const res = await remove(`/sku/${skuId}/images/${imageIndex}`);
    return res.data;
};

export const updateProduct = async (id: string, payload: IProductUpdatePayload) => {
    const res = await patch(`/product/${id}`, payload);
    return res.data;
};

export const updateSku = async (skuId: string, payload: ISkuUpdatePayload) => {
    const res = await patch(`/sku/${skuId}`, payload);
    return res.data;
};

export const createProduct = async (payload: IProductCreatePayload) => {
    const res = await post(`/product`, payload);
    return res.data;
};

export const createProductSku = async (payload: IProductCreateSkuPayload) => {
    const res = await post(`/sku`, payload);
    return res.data;
};

export const deleteProductSku = async (skuId: string) => {
    const res = await remove(`/sku/${skuId}`);
    return res.data;
};