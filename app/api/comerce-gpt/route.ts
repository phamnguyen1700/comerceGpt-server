import { openai } from "@/lib/openai";
import { Message } from "ai";
import { streamText } from "ai";
import { z } from "zod";
import { IProduct } from "@/types/product";
import { getAllProducts } from "@/services/product";

export const maxDuration = 30;

const prompt: Omit<Message, "id">[] = [
    {
        role: "system",
        content:
            `
        Bạn là một nhân viên tư vấn chăm sóc da chuyên nghiệp.
        Khi người dùng mở chatbox, bạn sẽ chủ động chào hỏi và giới thiệu về dịch vụ tư vấn da của bạn.
        Sau đó, bạn sẽ giúp khách hàng xác định được loại da của họ bằng cách đặt từng câu hỏi một để họ trả lời.
        Hãy nhớ là đặt từng câu một thôi không được hỏi 1 lần nhiều câu.
        
        Khi đã đủ thông tin về loại da và dị ứng, bạn phải trả lời ngay sản phẩm phù hợp cho khách hàng, không hỏi thêm nữa.
        Khi tìm kiếm sản phẩm, hãy tìm kiếm sản phẩm phù hợp với loại da của khách hàng.
        Nếu không tìm thấy sản phẩm phù hợp thì báo cho khách hàng biết rằng hiện tại không có sản phẩm phù hợp với loại da của khách hàng.

        Khi gọi tool "productSearch", bạn sẽ nhận về một object JSON như sau:

        {
         "type": "product-list",
         "products": [...],
         "message": "...",         nếu có
         "status": "out-of-stock"  hoặc "error"
        }

         ==> Nếu có mảng "products" và độ dài > 0:
         - Bạn phải mô tả ngay 2–3 sản phẩm một cách thân thiện, không cần hỏi lại khách hàng nữa.

         ==> Nếu status là "out-of-stock":
         - Hãy báo rằng hiện tại sản phẩm phù hợp đã hết hàng, và hỏi khách có muốn được thông báo khi có hàng mới không.

         ==> Nếu status là "error":
         - Báo lỗi lịch sự và mời khách thử lại sau.

        Nếu người dùng hỏi câu hỏi không liên quan hãy nói với họ rằng bạn chỉ tư vấn về da.
        `

    }
];

export async function OPTIONS() {
    return new Response(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}

export async function POST(req: Request) {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        });
    }

    try {
        const json = await req.json();
        const messages: Omit<Message, "id">[] = json.messages;
        const products = await getAllProducts();

        const firstCall = await streamText({
            model: openai("gpt-4o"),
            messages: prompt.concat(messages),
            experimental_activeTools: ["productSearch"],
            tools: {
                productSearch: {
                    description: `
                    Tiếp theo hãy hỏi khách hàng có bị dị ứng với thành phần nào không?
                    Nếu khách hàng không biết hãy tư vấn để giúp họ xác định có bị dị ứng với thành phần nào không.
                    Nếu khách hàng không bị dị ứng thì hãy tìm kiếm sản phẩm phù hợp theo tên hoặc loại da,... phù hợp với khách hàng đã tư vấn.
                    Nếu khách hàng có bị dị ứng thì hãy loại bỏ các sản phẩm có chứa thành phần bị dị ứng trong mảng ingredients của sản phẩm thì loại bỏ sản phẩm đó khỏi danh sách các sản phẩm tìm kiếm được phù hợp với khách hàng ở trên.
                    `,
                    parameters: z.object({
                        skinConcerns: z.enum([
                            "sensitive",
                            "dry",
                            "normal",
                            "combination",
                            "oily",
                        ]),
                    }),
                    execute: async ({ skinConcerns }) => {
                        console.log("🧪 [productSearch] Called with skinConcerns:", skinConcerns);
                        console.log("Products from store:", products);

                        try {
                            const matched = products.data.filter((product: IProduct) =>
                                product.skinConcerns?.includes(skinConcerns)
                            );

                            console.log("🔍 [productSearch] Matched products:", matched.length);

                            if (matched.length === 0) {
                                return {
                                    role: "assistant" as const,
                                    content: "Hiện tại các sản phẩm phù hợp với loại da này đã hết hàng.",
                                    description: "Không tìm thấy sản phẩm phù hợp với loại da",
                                };
                            }

                            return {
                                role: "assistant",
                                content: JSON.stringify({
                                    type: "product-list",
                                    products: matched.slice(0, 3),
                                    message: `Dưới đây là một số sản phẩm phù hợp với làn da của bạn:`
                                }),
                            };
                        } catch (err) {
                            console.error("❌ [productSearch] Error:", err);
                            return {
                                role: "assistant" as const,
                                content: "Đã xảy ra lỗi khi tìm sản phẩm. Vui lòng thử lại sau.",
                            };
                        }
                    }
                },
            },
        });

        const response = firstCall.toDataStreamResponse();
        console.log(response);
        
        const headers = new Headers(response.headers);
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        const reader = response.body?.getReader();
        if (!reader) {
            return new Response(JSON.stringify({
                success: false,
                message: 'No response body from GPT',
                timestamp: new Date().toISOString()
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                },
            });
        }
        let result = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            result += new TextDecoder().decode(value);
        }

        // Log ra nội dung thực tế sẽ trả về client
        console.log('RESPONSE TO CLIENT:', result);

        // result là toàn bộ chuỗi stream
        const lines = result.split('\n');
        let text = '';
        let productJson: Record<string, unknown> | null = null;

        for (const line of lines) {
            // Lấy các dòng chat thường
            const match = line.match(/^0:\"(.*)\"$/);
            if (match) {
                text += match[1];
            }
            // Lấy dòng trả về sản phẩm (dạng JSON trong dòng bắt đầu bằng a:)
            if (line.startsWith('a:')) {
                try {
                    const obj = JSON.parse(line.slice(2));
                    if (obj.result && obj.result.content) {
                        // content là chuỗi JSON, cần parse tiếp
                        productJson = JSON.parse(obj.result.content);
                    }
                } catch {}
            }
        }

        if (productJson) {
            // Trả về raw stream (nguyên chuỗi result)
            return new Response(result, {
                status: 200,
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                },
            });
        } else {
            // Trả về JSON message như cũ
            return new Response(JSON.stringify({
                success: true,
                message: text,
                timestamp: new Date().toISOString()
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                },
            });
        }
    } catch (error) {
        console.error("GPT ToolInvocation lỗi:", error);
        const encoder = new TextEncoder();
        const body = encoder.encode(
            `data: ${JSON.stringify({
                id: Date.now(),
                role: "assistant",
                content:
                    "Xin lỗi, hiện tại hệ thống đang gặp sự cố kỹ thuật. Bạn vui lòng thử lại sau ít phút nhé!",
            })}\n\n`
        );

        return new Response(body, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
        });
    }
}