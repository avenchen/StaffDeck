from __future__ import annotations

import sys
from pathlib import Path

from sqlmodel import Session, select

from app import paths
from app.agents.branching import ensure_open_gallery_binding
from app.config import get_settings
from app.db.models import (
    AgentProfile,
    GeneralSkill,
    MCPServer,
    ModelConfig,
    PersonaConfig,
    Skill,
    Tenant,
    Tool,
    User,
    utc_now,
)
from app.security.encryption import encrypt_secret
from app.security.auth import hash_password
from app.staffdeck_seed import seed_staffdeck_admin_gallery


ADAPTIVE_FLOW_RULE = (
    "步驟是可自適應推進的目標，不是固定問答腳本；已由當前用戶消息、歷史信息或路由意圖滿足的內容"
    "不得重複追問，應直接推進到下一缺失信息、工具調用或最終回覆。"
)


REFUND_SKILL = {
    "skill_id": "after_sales_refund",
    "name": "售後退款流程",
    "version": "1.0.0",
    "business_domain": "after_sales",
    "description": "處理用戶退款、退貨、取消訂單等訴求。",
    "trigger_intents": ["退款", "退貨", "取消訂單", "不想要了"],
    "user_utterance_examples": ["我想退貨", "這個不要了", "買錯了能退嗎", "給我退錢"],
    "goal": [
        "確認用戶退款訴求",
        "收集訂單號",
        "確認處理對象",
        "查詢訂單狀態",
        "說明退款政策",
        "引導用戶繼續處理或轉人工",
    ],
    "required_info": ["order_id", "refund_reason"],
    "slot_filling_policy": {
        "enabled": True,
        "multi_slot_per_turn": True,
        "extract_scope": "all_skill_expected_user_info",
        "skip_satisfied_steps": True,
        "description": "每輪同時抽取用戶已表達的退款類型、訂單號、退款原因和確認意願等信息，已滿足的信息不再追問。",
        "target_info": ["refund_type", "order_id", "order_confirmed", "refund_reason"],
    },
    "nodes": [
        {
            "node_id": "identify_refund_intent",
            "name": "確認退款訴求",
            "instruction": "將本步驟作為目標而不是固定話術；僅當用戶訴求不明確時確認用戶是否要退款、退貨或取消訂單；如果用戶已明確說退貨/退款/取消訂單，寫入 refund_type 並直接進入下一缺失信息收集，不要反問類型。",
            "expected_user_info": ["refund_type"],
            "allowed_actions": ["ask_clarification", "continue_flow"],
        },
        {
            "node_id": "collect_order_info",
            "name": "收集訂單信息",
            "instruction": "將本步驟作為目標而不是固定話術；如果用戶未提供訂單號，直接詢問訂單號；如果用戶明確提供訂單號，寫入 order_id 並進入確認步驟；如果 order_id 是根據 recent_messages、上一筆訂單或上下文推斷出來的，必須進入確認步驟，不得直接調用工具。不要再詢問用戶是退貨還是退款。",
            "expected_user_info": ["order_id"],
            "allowed_actions": ["ask_user", "continue_flow"],
        },
        {
            "node_id": "confirm_refund_order",
            "name": "確認售後訂單",
            "instruction": "在查詢或處理退款/退貨/取消訂單前，必須向用戶確認本次要處理的訂單號和訴求類型。只有用戶明確確認後，才能寫入 order_confirmed=true 並繼續；如果用戶說不是、另一個、換一個，應清空或更新 order_id 並回到訂單信息收集。",
            "expected_user_info": ["order_confirmed"],
            "allowed_actions": ["ask_user", "continue_flow"],
        },
        {
            "node_id": "check_refund_eligibility",
            "name": "查詢退款資格",
            "instruction": "將本步驟作為目標而不是固定話術；僅當 order_id 已存在且 order_confirmed=true 時調用 order.query；根據訂單查詢結果說明是否可能支持退款/退貨，不要承諾一定成功；如還缺原因則繼續收集，已滿足時給出明確下一步。",
            "expected_user_info": [],
            "allowed_actions": [
                "continue_flow",
                "call_tool:order.query",
                "answer_user",
                "handoff_human",
            ],
        },
        {
            "node_id": "collect_refund_reason",
            "name": "收集退款原因",
            "instruction": "將本步驟作為目標而不是固定話術；如果用戶已說明退款原因，寫入 refund_reason 並繼續推進；否則只追問退款原因，不重複追問退款類型或訂單號。",
            "expected_user_info": ["refund_reason"],
            "allowed_actions": ["ask_user", "continue_flow"],
        },
    ],
    "interruption_policy": {
        "related_question": "可以臨時回答，回答後回到當前退款流程。",
        "unrelated_business": "可以切換到新技能，並保存當前流程進度。",
        "chitchat": "簡短回應後，引導用戶繼續退款流程。",
        "user_wants_human": "直接轉人工。",
    },
    "response_rules": [
        "不要承諾一定能退款。",
        "未查詢訂單前，不要判斷是否符合退款條件。",
        "退款、退貨或取消訂單前必須先向用戶確認訂單號和訴求類型。",
        "如果用戶要求人工，應轉人工。",
        ADAPTIVE_FLOW_RULE,
    ],
}

EXCHANGE_SKILL = {
    "skill_id": "after_sales_exchange",
    "name": "售後換貨流程",
    "version": "1.0.0",
    "business_domain": "after_sales",
    "description": "處理用戶換貨、更換商品、尺碼顏色不合適等訴求。",
    "trigger_intents": ["換貨", "更換商品", "換尺碼", "換顏色"],
    "user_utterance_examples": ["我想換貨", "能不能換個顏色", "尺碼不合適想換一下"],
    "goal": ["確認換貨訴求", "收集訂單號", "確認換貨原因", "引導用戶繼續處理或轉人工"],
    "required_info": ["order_id", "exchange_reason"],
    "slot_filling_policy": {
        "enabled": True,
        "multi_slot_per_turn": True,
        "extract_scope": "all_skill_expected_user_info",
        "skip_satisfied_steps": True,
        "description": "每輪同時抽取用戶已表達的換貨類型、訂單號、換貨原因等信息，已滿足的信息不再追問。",
        "target_info": ["exchange_type", "order_id", "exchange_reason"],
    },
    "nodes": [
        {
            "node_id": "identify_exchange_intent",
            "name": "確認換貨訴求",
            "instruction": "將本步驟作為目標而不是固定話術；如果用戶已表達換貨商品或換貨類型，寫入 exchange_type 並繼續推進；僅在訴求不明確時追問。",
            "expected_user_info": ["exchange_type"],
            "allowed_actions": ["ask_clarification", "continue_flow"],
        },
        {
            "node_id": "collect_exchange_order_info",
            "name": "收集訂單信息",
            "instruction": "將本步驟作為目標而不是固定話術；如果用戶已提供訂單號，寫入 order_id 並調用 order.query；否則詢問訂單號，並只追問真正缺失的換貨信息。",
            "expected_user_info": ["order_id"],
            "allowed_actions": ["ask_user", "call_tool:order.query"],
        },
    ],
    "interruption_policy": {
        "related_question": "可以臨時回答，回答後回到當前換貨流程。",
        "unrelated_business": "可以切換到新技能，並保存當前流程進度。",
        "chitchat": "簡短回應後，引導用戶繼續換貨流程。",
        "user_wants_human": "直接轉人工。",
    },
    "response_rules": ["不要承諾一定能換貨。", "如政策不確定，應轉人工確認。", ADAPTIVE_FLOW_RULE],
}

PURCHASE_SKILL = {
    "skill_id": "skill_purchase_001",
    "name": "購買商品流程",
    "version": "1.0.0",
    "business_domain": "commerce",
    "description": "引導用戶完成商品購買流程，包括收集用戶信息、確認商品、生成訂單並反饋結果。",
    "trigger_intents": ["購買商品", "下單", "買東西", "購買", "place_order"],
    "user_utterance_examples": ["我想買這個商品", "幫我下單", "我要購買 A1", "我要買一個a1"],
    "goal": [
        "獲取用戶身份信息",
        "確認購買的商品及數量",
        "確認下單意願",
        "生成有效訂單",
        "向用戶反饋訂單號及狀態",
    ],
    "required_info": ["user_name", "product_id", "quantity"],
    "slot_filling_policy": {
        "enabled": True,
        "multi_slot_per_turn": True,
        "extract_scope": "all_skill_expected_user_info",
        "skip_satisfied_steps": True,
        "description": "每輪同時抽取用戶已表達的姓名、商品 ID、購買數量和下單確認等信息；數量需理解口語數字和量詞表達，已滿足的信息不再追問。",
        "target_info": ["user_name", "product_id", "quantity", "purchase_confirmed"],
    },
    "nodes": [
        {
            "node_id": "collect_user_name",
            "name": "收集用戶信息與商品詳情",
            "instruction": (
                "將本步驟作為目標而不是固定話術；同時收集用戶姓名、商品 ID 和數量。"
                "用戶一句話提供多個信息時必須一次性寫入 slot_updates；"
                "數值字段需要理解口語數字和量詞表達，例如“一個/一件/一臺”表示 1，“兩個/兩件”表示 2，“三份/3個”表示 3。"
                "已提供的信息不再追問，只追問真正缺失的信息；全部滿足後進入下單確認，不要直接創建訂單。"
            ),
            "expected_user_info": ["user_name", "product_id", "quantity"],
            "allowed_actions": ["ask_user", "continue_flow"],
        },
        {
            "node_id": "confirm_purchase",
            "name": "確認下單信息",
            "instruction": "創建訂單前必須向用戶確認姓名、商品 ID 和數量。只有用戶明確確認後，才能寫入 purchase_confirmed=true 並繼續；如果用戶修改商品、數量或姓名，應更新對應 slot 並重新確認。",
            "expected_user_info": ["purchase_confirmed"],
            "allowed_actions": ["ask_user", "continue_flow"],
        },
        {
            "node_id": "confirm_product",
            "name": "執行購買/創建訂單",
            "instruction": (
                "將本步驟作為目標而不是固定話術；僅當 user_name、product_id、quantity 已滿足且 purchase_confirmed=true 時，"
                "直接調用 product.purchase 或 order.add 創建訂單，不要重複確認商品或數量。"
                "如果工具需要 user_id 且只有 user_name，可將 user_name 作為 user_id。"
            ),
            "expected_user_info": ["product_id", "quantity", "purchase_confirmed"],
            "allowed_actions": [
                "continue_flow",
                "call_tool:product.purchase",
                "call_tool:order.add",
            ],
        },
        {
            "node_id": "create_order",
            "name": "反饋訂單結果",
            "instruction": "將工具返回的訂單號、商品信息、數量、金額和狀態告知用戶，確認購買結果；不要只說請稍候。",
            "expected_user_info": [],
            "allowed_actions": ["answer_user"],
        },
    ],
    "interruption_policy": {
        "related_question": "可以臨時回答，回答後回到當前購買流程。",
        "unrelated_business": "可以切換到新技能，並保存當前流程進度。",
        "chitchat": "簡短回應後，引導用戶繼續購買流程。",
        "user_wants_human": "直接轉人工。",
    },
    "response_rules": [
        "保持語氣友好、專業。",
        "明確告知用戶訂單號。",
        "創建訂單前必須先向用戶確認姓名、商品 ID 和數量。",
        "若商品不存在或庫存不足，需明確告知用戶並建議其他操作。",
        ADAPTIVE_FLOW_RULE,
    ],
}

PRICE_COMPARE_SKILL = {
    "skill_id": "skill_price_compare_001",
    "name": "商品比價服務",
    "version": "1.0.0",
    "business_domain": "commerce",
    "description": "根據用戶提供的兩個商品名稱，查詢價格、品牌和規格後給出比價結果。",
    "trigger_intents": ["商品比價", "價格對比", "比下價格", "比較價格", "哪個更便宜"],
    "user_utterance_examples": [
        "幫我比一下 A1 和 A3 的價格",
        "買之前想看看 A1 和 iPhone 15 哪個更划算",
        "A1 跟 A3 價格差多少",
    ],
    "goal": ["收集兩個待比價商品", "分別查詢商品價格", "基於工具結果給出比價結論"],
    "required_info": ["product_name_1", "product_name_2"],
    "slot_filling_policy": {
        "enabled": True,
        "multi_slot_per_turn": True,
        "extract_scope": "all_skill_expected_user_info",
        "skip_satisfied_steps": True,
        "description": "每輪同時抽取用戶提到的兩個待比較商品名稱；如果只給出一個商品，應只追問另一個。",
        "target_info": ["product_name_1", "product_name_2"],
    },
    "nodes": [
        {
            "node_id": "collect_products",
            "name": "收集待比價商品",
            "instruction": (
                "將本步驟作為目標而不是固定話術；從當前消息、歷史對話和 slots 中識別兩個待比價商品。"
                "用戶一次給出兩個商品時，必須同時寫入 product_name_1 和 product_name_2 並繼續；"
                "只缺一個商品時只追問缺失的那個，不要重複確認已給出的商品。"
            ),
            "expected_user_info": ["product_name_1", "product_name_2"],
            "allowed_actions": ["ask_user", "continue_flow"],
        },
        {
            "node_id": "query_prices",
            "name": "查詢商品價格",
            "instruction": (
                "當 product_name_1 和 product_name_2 都已獲得時，依次調用 product.price_query 查詢兩個商品。"
                "不要編造價格；如果只查到一個商品，應繼續調用工具查詢另一個商品；"
                "兩個工具結果都齊全後進入結果回覆。"
            ),
            "expected_user_info": [],
            "allowed_actions": ["call_tool:product.price_query", "continue_flow"],
        },
        {
            "node_id": "reply_compare_result",
            "name": "反饋比價結果",
            "instruction": (
                "基於累計工具結果對比兩個商品的價格、品牌和規格，說明哪個更便宜、差價多少；"
                "如果某個商品未找到或工具失敗，應明確說明無法完成該商品的比價，並給出下一步建議。"
            ),
            "expected_user_info": [],
            "allowed_actions": ["answer_user"],
        },
    ],
    "interruption_policy": {
        "related_question": "可以臨時回答，回答後回到當前比價流程。",
        "unrelated_business": "可以切換到新技能，並保存當前流程進度。",
        "chitchat": "簡短回應後，引導用戶繼續比價流程。",
        "user_wants_human": "直接轉人工。",
    },
    "response_rules": [
        "不要在沒有工具結果時編造價格。",
        "若工具未查到商品，應明確說明並請用戶更換商品名或轉人工。",
        "比價結論必須引用工具返回的價格、品牌或規格信息。",
        ADAPTIVE_FLOW_RULE,
    ],
}

GRAPH_VISUAL_DEMO_SKILL = {
    "skill_id": "skill_graph_visual_demo",
    "name": "圖結構可視化驗證流程",
    "version": "1.0.0",
    "business_domain": "demo",
    "description": "用於驗證 graph-only 技能流程圖的分支、可選節點、工具節點、知識節點和終止節點展示效果。",
    "trigger_intents": ["圖結構驗證", "流程圖驗證", "graph demo", "驗證分支流程"],
    "user_utterance_examples": [
        "幫我跑一下圖結構驗證",
        "我要驗證一個包含分支和工具的流程",
        "這個流程需要先查價格再確認",
    ],
    "goal": [
        "識別用戶要驗證的處理路徑",
        "按條件進入工具或知識分支",
        "必要時確認",
        "給出最終結果或轉人工",
    ],
    "required_info": ["request_type"],
    "slot_filling_policy": {
        "enabled": True,
        "multi_slot_per_turn": True,
        "extract_scope": "all_skill_expected_user_info",
        "skip_satisfied_steps": True,
        "target_info": ["request_type", "product_name", "confirmation"],
    },
    "nodes": [
        {
            "node_id": "intake_request",
            "type": "collect_info",
            "name": "識別驗證請求",
            "instruction": "識別用戶想驗證的是工具路徑、知識路徑、直接確認路徑還是人工路徑；若用戶已說明目標，寫入 request_type 並推進。",
            "expected_user_info": ["request_type"],
            "allowed_actions": ["ask_user", "continue_flow"],
        },
        {
            "node_id": "classify_path",
            "type": "decision",
            "name": "選擇處理分支",
            "instruction": "根據 request_type 選擇後續路徑：需要外部數據時進入工具節點；需要政策依據時進入知識節點；已滿足條件時進入確認節點；無法判斷時轉人工。",
            "expected_user_info": [],
            "allowed_actions": ["continue_flow", "handoff_human"],
        },
        {
            "node_id": "query_product_price",
            "type": "tool_call",
            "name": "查詢商品價格",
            "instruction": "當用戶提供商品名或要求驗證工具分支時，調用 product.price_query 查詢商品價格、品牌和規格；工具失敗時讓模型基於結果決定重試、換路徑或追問。",
            "expected_user_info": ["product_name"],
            "allowed_actions": ["ask_user", "call_tool:product.price_query", "continue_flow"],
            "retry_policy": {"max_attempts": 2, "on_failure": "reflect"},
        },
        {
            "node_id": "read_policy_knowledge",
            "type": "knowledge_query",
            "name": "讀取處理依據",
            "instruction": "當用戶需要解釋規則或依據時，檢索當前智能體可見知識庫中的相關桶和片段，並把知識結果交給模型繼續判斷。",
            "expected_user_info": [],
            "allowed_actions": ["knowledge_query", "continue_flow"],
            "knowledge_scope": {"bucket_hint": "demo_policy"},
        },
        {
            "node_id": "confirm_action",
            "type": "decision",
            "name": "可選確認",
            "instruction": "如動作會產生業務影響，先向用戶確認；若用戶已經明確確認，可跳過追問並繼續回覆。",
            "optional": True,
            "expected_user_info": ["confirmation"],
            "allowed_actions": ["ask_user", "continue_flow"],
        },
        {
            "node_id": "reply_result",
            "type": "response",
            "name": "反饋驗證結果",
            "instruction": "彙總已選擇的分支、工具結果或知識依據，用簡潔語言反饋本次 graph 流程驗證結果。",
            "expected_user_info": [],
            "allowed_actions": ["answer_user"],
        },
        {
            "node_id": "handoff_manual",
            "type": "handoff",
            "name": "轉人工處理",
            "instruction": "當用戶明確要求人工或模型判斷無法可靠完成時，說明需要人工繼續處理。",
            "expected_user_info": [],
            "allowed_actions": ["handoff_human"],
        },
    ],
    "edges": [
        {
            "source_node_id": "intake_request",
            "next_node_id": "classify_path",
            "condition": "request_type 已識別",
            "priority": 0,
            "label": "進入分支判斷",
        },
        {
            "source_node_id": "classify_path",
            "next_node_id": "query_product_price",
            "condition": "需要外部商品數據",
            "priority": 0,
            "label": "工具路徑",
        },
        {
            "source_node_id": "classify_path",
            "next_node_id": "read_policy_knowledge",
            "condition": "需要知識依據",
            "priority": 1,
            "label": "知識路徑",
        },
        {
            "source_node_id": "classify_path",
            "next_node_id": "confirm_action",
            "condition": "信息充分但需要確認",
            "priority": 2,
            "label": "確認路徑",
        },
        {
            "source_node_id": "classify_path",
            "next_node_id": "handoff_manual",
            "condition": "用戶要求人工或無法判斷",
            "priority": 3,
            "label": "人工路徑",
        },
        {
            "source_node_id": "query_product_price",
            "next_node_id": "confirm_action",
            "condition": "工具結果可用",
            "priority": 0,
            "label": "核驗後確認",
        },
        {
            "source_node_id": "query_product_price",
            "next_node_id": "handoff_manual",
            "condition": "工具失敗且反思後仍無法處理",
            "priority": 1,
            "label": "工具失敗",
        },
        {
            "source_node_id": "read_policy_knowledge",
            "next_node_id": "reply_result",
            "condition": "知識依據足夠",
            "priority": 0,
            "label": "依據充分",
        },
        {
            "source_node_id": "confirm_action",
            "next_node_id": "reply_result",
            "condition": "用戶確認或可跳過確認",
            "priority": 0,
            "label": "完成確認",
        },
        {
            "source_node_id": "confirm_action",
            "next_node_id": "handoff_manual",
            "condition": "用戶拒絕或需要人工",
            "priority": 1,
            "label": "確認失敗",
        },
    ],
    "start_node_id": "intake_request",
    "terminal_node_ids": ["reply_result", "handoff_manual"],
    "interruption_policy": {
        "related_question": "可以回答後繼續當前驗證流程。",
        "unrelated_business": "可保存當前驗證流程並切換任務。",
        "chitchat": "簡短回應後繼續引導用戶完成驗證。",
        "user_wants_human": "直接轉人工。",
    },
    "response_rules": [
        "不要編造工具結果。",
        "涉及知識依據時必須基於檢索結果回覆。",
        ADAPTIVE_FLOW_RULE,
    ],
}

ORDER_QUERY_TOOL = {
    "name": "order.query",
    "display_name": "訂單查詢",
    "description": "根據訂單號查詢訂單狀態、簽收天數和是否可能支持退款。",
    "bucket": "訂單工具",
    "method": "POST",
    "url": "/api/mock/order/query",
    "headers_json": {},
    "auth_json": {},
    "input_schema": {
        "type": "object",
        "properties": {"order_id": {"type": "string", "description": "訂單號"}},
        "required": ["order_id"],
    },
    "output_schema": {
        "type": "object",
        "properties": {
            "order_id": {"type": "string"},
            "found": {"type": "boolean"},
            "status": {"type": "string"},
            "signed_days": {"type": "integer"},
            "refundable": {"type": "boolean"},
            "miss_reason": {"type": "string"},
        },
    },
    "allowed_skills_json": ["after_sales_refund", "after_sales_exchange"],
    "enabled": True,
}

ORDER_ARCHIVE_QUERY_TOOL = {
    "name": "order.archive_query",
    "display_name": "歷史訂單查詢",
    "description": "備用訂單查詢工具；當 order.query 主訂單中心未命中、found=false、miss_reason 或歷史訂單場景時，用同一 order_id 查詢歸檔訂單。",
    "bucket": "訂單工具",
    "method": "POST",
    "url": "/api/mock/order/archive-query",
    "headers_json": {},
    "auth_json": {},
    "input_schema": {
        "type": "object",
        "properties": {"order_id": {"type": "string", "description": "訂單號"}},
        "required": ["order_id"],
    },
    "output_schema": {
        "type": "object",
        "properties": {
            "order_id": {"type": "string"},
            "found": {"type": "boolean"},
            "source": {"type": "string"},
            "status": {"type": "string"},
            "signed_days": {"type": "integer"},
            "refundable": {"type": "boolean"},
            "recommendation": {"type": "string"},
        },
    },
    "allowed_skills_json": ["after_sales_refund", "after_sales_exchange"],
    "enabled": True,
}

PRODUCT_PURCHASE_TOOL = {
    "name": "product.purchase",
    "display_name": "購買商品",
    "description": "模擬用戶購買商品，返回支付後的訂單與購買記錄。",
    "bucket": "商品工具",
    "method": "POST",
    "url": "/api/mock/product/purchase",
    "headers_json": {},
    "auth_json": {},
    "input_schema": {
        "type": "object",
        "properties": {
            "user_id": {"type": "string", "description": "用戶 ID"},
            "product_id": {"type": "string", "description": "商品 ID，如 SKU-001"},
            "sku_id": {"type": "string", "description": "可選 SKU ID"},
            "quantity": {"type": "integer", "minimum": 1, "maximum": 99, "description": "購買數量"},
            "payment_method": {"type": "string", "description": "支付方式"},
        },
        "required": ["product_id"],
    },
    "output_schema": {
        "type": "object",
        "properties": {
            "found": {"type": "boolean"},
            "order_id": {"type": "string"},
            "purchase_id": {"type": "string"},
            "product_id": {"type": "string"},
            "display_name": {"type": "string"},
            "quantity": {"type": "integer"},
            "unit_price": {"type": "number"},
            "payment_status": {"type": "string"},
            "order_status": {"type": "string"},
            "total_amount": {"type": "number"},
            "currency": {"type": "string"},
        },
    },
    "allowed_skills_json": [],
    "enabled": True,
}

ORDER_ADD_TOOL = {
    "name": "order.add",
    "display_name": "訂單添加",
    "description": "模擬新增一筆訂單，返回訂單號、商品、金額和訂單狀態。",
    "bucket": "訂單工具",
    "method": "POST",
    "url": "/api/mock/order/add",
    "headers_json": {},
    "auth_json": {},
    "input_schema": {
        "type": "object",
        "properties": {
            "user_id": {"type": "string", "description": "用戶 ID"},
            "order_id": {"type": "string", "description": "可選自定義訂單號"},
            "product_id": {"type": "string", "description": "商品 ID，如 SKU-001"},
            "sku_id": {"type": "string", "description": "可選 SKU ID"},
            "quantity": {"type": "integer", "minimum": 1, "maximum": 99, "description": "商品數量"},
            "status": {"type": "string", "description": "訂單初始狀態"},
        },
        "required": ["product_id"],
    },
    "output_schema": {
        "type": "object",
        "properties": {
            "found": {"type": "boolean"},
            "order_id": {"type": "string"},
            "user_id": {"type": "string"},
            "product_id": {"type": "string"},
            "display_name": {"type": "string"},
            "quantity": {"type": "integer"},
            "unit_price": {"type": "number"},
            "status": {"type": "string"},
            "total_amount": {"type": "number"},
            "currency": {"type": "string"},
        },
    },
    "allowed_skills_json": [],
    "enabled": True,
}

PRODUCT_PRICE_QUERY_TOOL = {
    "name": "product.price_query",
    "display_name": "商品價格查詢",
    "description": "根據商品名稱查詢商品價格、品牌、規格和更新時間，用於商品比價。",
    "bucket": "商品工具",
    "method": "POST",
    "url": "/api/mock/product/price-query",
    "headers_json": {},
    "auth_json": {},
    "input_schema": {
        "type": "object",
        "properties": {
            "product_name": {
                "type": "string",
                "description": "商品名稱或商品別名，如 A1、A3、iPhone 15",
            }
        },
        "required": ["product_name"],
    },
    "output_schema": {
        "type": "object",
        "properties": {
            "product_name": {"type": "string"},
            "found": {"type": "boolean"},
            "source": {"type": "string"},
            "product_id": {"type": "string"},
            "display_name": {"type": "string"},
            "brand": {"type": "string"},
            "price": {"type": "number"},
            "currency": {"type": "string"},
            "spec": {"type": "string"},
            "updated_at": {"type": "string"},
        },
    },
    "allowed_skills_json": ["skill_price_compare_001", "skill_graph_visual_demo"],
    "enabled": True,
}

MOCK_MCP_STDIO_SERVER = paths.resource_dir() / "mock_servers" / "mcp_stdio_server.py"


def _stdio_mcp_python() -> str:
    # 打包態 sys.executable 指向 ultrarag 引導器，需用附帶 Python
    if paths.is_frozen():
        from app.general_skills.runtime_env import _bundled_python

        bundled = _bundled_python()
        if bundled.exists():
            return str(bundled)
    return sys.executable


# --------------------------------------------------------------------------- #
# MCP Servers（工具集）與其發現出的子工具
# --------------------------------------------------------------------------- #

MCP_BUILTIN_DEMO_SERVER = {
    "name": "builtin_demo",
    "display_name": "內置 Demo MCP",
    "description": "內置 MCP demo server，用於驗證 MCP 工具集的連接、發現與調用鏈路。",
    "bucket": "MCP 工具",
    "transport": "builtin",
    "url": None,
    "headers_json": {},
    "command": None,
    "args_json": [],
    "env_json": {},
    "cwd": None,
    "enabled": True,
}

MCP_STDIO_DEMO_SERVER = {
    "name": "stdio_demo",
    "display_name": "Stdio Demo MCP",
    "description": "真實 stdio MCP mock server，用於驗證 MCP client transport、初始化和 tools/list、tools/call 鏈路。",
    "bucket": "MCP 工具",
    "transport": "stdio",
    "url": None,
    "headers_json": {},
    "command": None,  # 由 _seed_mcp_servers 運行時惰性注入（見下）
    "args_json": [str(MOCK_MCP_STDIO_SERVER)],
    "env_json": {},
    "cwd": None,
    "enabled": True,
}

MCP_SERVERS = (
    MCP_BUILTIN_DEMO_SERVER,
    MCP_STDIO_DEMO_SERVER,
)

# 每個 MCP server 預先落地的子工具（模擬已執行過一次「發現/同步」）。
# config_json 只放 leaf tool 名，連接配置由 mcp_server_id 關聯的 server 提供。
MCP_SERVER_TOOLS = {
    "builtin_demo": [
        {
            "leaf": "echo",
            "display_name": "MCP Demo Echo",
            "description": "內置 MCP demo echo 工具，回顯文本並返回長度。",
            "input_schema": {
                "type": "object",
                "properties": {
                    "text": {
                        "type": "string",
                        "description": "要回顯的文本",
                        "example": "hello mcp",
                    }
                },
                "required": ["text"],
            },
            "output_schema": {
                "type": "object",
                "properties": {"text": {"type": "string"}, "length": {"type": "integer"}},
            },
            "allowed_skills_json": [],
        },
    ],
    "stdio_demo": [
        {
            "leaf": "product_lookup",
            "display_name": "MCP Stdio 商品查詢",
            "description": "stdio MCP mock server 的商品查詢工具。",
            "input_schema": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "string", "description": "商品 ID，例如 A1 或 A3"}
                },
                "required": ["product_id"],
            },
            "output_schema": {
                "type": "object",
                "properties": {
                    "found": {"type": "boolean"},
                    "product_id": {"type": "string"},
                    "display_name": {"type": "string"},
                    "price": {"type": "number"},
                    "currency": {"type": "string"},
                },
            },
            "allowed_skills_json": ["skill_price_compare_001", "skill_graph_visual_demo"],
        },
    ],
}

DEMO_TOOLS = (
    ORDER_QUERY_TOOL,
    ORDER_ARCHIVE_QUERY_TOOL,
    PRODUCT_PURCHASE_TOOL,
    ORDER_ADD_TOOL,
    PRODUCT_PRICE_QUERY_TOOL,
)
DEFAULT_PERSONA_PROMPT = (
    "你是面壁智能的智能客服，語氣專業、清晰、友好。"
    "你需要先理解用戶訴求，再基於已配置的技能和工具幫助用戶完成業務辦理。"
    "不要暴露內部路由、技能 ID、步驟 ID 或工具實現細節。"
)


def _seed_mcp_servers(session: Session) -> None:
    """落地 demo MCP server（工具集）及其已發現的子工具。"""
    for server_config in MCP_SERVERS:
        server_config = dict(server_config)  # 避免修改模塊級常量
        if server_config.get("name") == "stdio_demo":
            server_config["command"] = _stdio_mcp_python()
        server = session.exec(
            select(MCPServer).where(
                MCPServer.tenant_id == "tenant_demo", MCPServer.name == server_config["name"]
            )
        ).first()
        if not server:
            server = MCPServer(tenant_id="tenant_demo", **server_config)
            session.add(server)
            session.flush()
        else:
            for key, value in server_config.items():
                setattr(server, key, value)
            server.updated_at = utc_now()
            session.add(server)

        for tool_def in MCP_SERVER_TOOLS.get(server_config["name"], []):
            leaf = tool_def["leaf"]
            scoped_name = f"{server.name}.{leaf}"
            tool = session.exec(
                select(Tool).where(Tool.tenant_id == "tenant_demo", Tool.name == scoped_name)
            ).first()
            payload = {
                "display_name": tool_def.get("display_name") or leaf,
                "description": tool_def.get("description") or "",
                "bucket": server.bucket or "MCP 工具",
                "tool_type": "mcp",
                "method": "POST",
                "url": f"mcp://{server.name}/{leaf}",
                "headers_json": {},
                "auth_json": {},
                "config_json": {"tool": leaf},
                "input_schema": tool_def.get("input_schema") or {},
                "output_schema": tool_def.get("output_schema") or {},
                "allowed_skills_json": tool_def.get("allowed_skills_json") or [],
                "mcp_server_id": server.id,
                "enabled": True,
            }
            if not tool:
                session.add(Tool(tenant_id="tenant_demo", name=scoped_name, **payload))
            else:
                for key, value in payload.items():
                    setattr(tool, key, value)
                tool.updated_at = utc_now()
                session.add(tool)
        server.last_synced_at = utc_now()
        session.add(server)


def seed_demo_data(session: Session) -> None:
    settings = get_settings()
    if not session.get(Tenant, "tenant_demo"):
        session.add(Tenant(id="tenant_demo", name="Demo Enterprise"))

    if not session.get(PersonaConfig, "tenant_demo"):
        session.add(PersonaConfig(tenant_id="tenant_demo", system_prompt=DEFAULT_PERSONA_PROMPT))

    demo_user = session.exec(
        select(User).where(User.tenant_id == "tenant_demo", User.username == "user_demo")
    ).first()
    if not demo_user:
        session.add(
            User(
                id="user_demo",
                tenant_id="tenant_demo",
                username="user_demo",
                display_name="Demo User",
                password_hash=hash_password("demo"),
            )
        )

    # 桌面/單機版默認管理員賬號（admin / admin）。權限只讀取數據庫 role 字段。
    admin_user = session.exec(
        select(User).where(User.tenant_id == "tenant_demo", User.username == "admin")
    ).first()
    if not admin_user:
        session.add(
            User(
                id="admin",
                tenant_id="tenant_demo",
                username="admin",
                display_name="Administrator",
                role="admin",
                password_hash=hash_password("admin"),
            )
        )
    elif admin_user.role != "admin":
        admin_user.role = "admin"
        admin_user.updated_at = utc_now()
        session.add(admin_user)

    _ensure_seed_agents(session)

    for raw_content in (
        REFUND_SKILL,
        EXCHANGE_SKILL,
        PURCHASE_SKILL,
        PRICE_COMPARE_SKILL,
        GRAPH_VISUAL_DEMO_SKILL,
    ):
        content = _skill_content_graph(raw_content)
        existing = session.exec(
            select(Skill).where(
                Skill.tenant_id == "tenant_demo", Skill.skill_id == content["skill_id"]
            )
        ).first()
        if not existing:
            session.add(
                Skill(
                    tenant_id="tenant_demo",
                    skill_id=content["skill_id"],
                    version=content["version"],
                    name=content["name"],
                    business_domain=content["business_domain"],
                    description=content["description"],
                    content_json=content,
                    status="published",
                )
            )
        else:
            _sync_demo_skill_if_stale(existing, content)

    for tool_config in DEMO_TOOLS:
        tool_config = _tool_config_with_base_url(tool_config, settings.normalized_tool_base_url)
        tool = session.exec(
            select(Tool).where(Tool.tenant_id == "tenant_demo", Tool.name == tool_config["name"])
        ).first()
        if not tool:
            session.add(Tool(tenant_id="tenant_demo", **tool_config))
        else:
            tool.bucket = tool_config.get("bucket") or tool.bucket or "未分桶"
            tool.display_name = tool_config.get("display_name") or tool.display_name
            tool.description = tool_config.get("description") or tool.description
            tool.method = tool_config.get("method") or tool.method
            tool.url = tool_config.get("url") or tool.url
            tool.tool_type = (
                tool_config.get("tool_type") or getattr(tool, "tool_type", None) or "http"
            )
            tool.headers_json = tool_config.get("headers_json") or tool.headers_json
            tool.auth_json = tool_config.get("auth_json") or tool.auth_json
            tool.config_json = tool_config.get("config_json") or tool.config_json
            tool.input_schema = tool_config.get("input_schema") or tool.input_schema
            tool.output_schema = tool_config.get("output_schema") or tool.output_schema
            configured_skills = [
                str(skill_id)
                for skill_id in (tool_config.get("allowed_skills_json") or [])
                if str(skill_id).strip()
            ]
            existing_skills = [
                str(skill_id)
                for skill_id in (tool.allowed_skills_json or [])
                if str(skill_id).strip()
            ]
            tool.allowed_skills_json = list(
                dict.fromkeys([*configured_skills, *existing_skills])
            )
            tool.enabled = bool(tool_config.get("enabled", tool.enabled))
            tool.updated_at = utc_now()
            session.add(tool)

    _seed_mcp_servers(session)
    _seed_weather_general_skill(session)
    session.flush()
    _publish_seeded_system_resources(session)
    seed_staffdeck_admin_gallery(session)

    default_model = session.exec(
        select(ModelConfig).where(
            ModelConfig.tenant_id == "tenant_demo",
            ModelConfig.is_default == True,  # noqa: E712
        )
    ).first()
    if not default_model and settings.demo_model_api_key:
        session.add(
            ModelConfig(
                tenant_id="tenant_demo",
                name=settings.demo_model_name or "Default Model",
                provider=settings.demo_model_provider,
                base_url=settings.demo_model_base_url or None,
                api_key_encrypted=encrypt_secret(settings.demo_model_api_key),
                model=settings.demo_model_name,
                temperature=0.2,
                max_output_tokens=8192,
                is_default=True,
                enabled=True,
            )
        )

    # Every user belongs to a department: ensure the tenant root and backfill.
    from app.departments.service import ensure_root_department

    root = ensure_root_department(session, "tenant_demo")
    for user in session.exec(
        select(User).where(User.tenant_id == "tenant_demo", User.department_id.is_(None))
    ).all():
        user.department_id = root.id
        session.add(user)

    session.commit()


def _publish_seeded_system_resources(session: Session) -> None:
    tenant_id = "tenant_demo"
    creator_metadata = _system_seed_metadata()

    overall = session.get(AgentProfile, f"agent_{tenant_id}_overall")
    if overall:
        overall.metadata_json = _system_seed_metadata(overall.metadata_json or {})
        session.add(overall)

    _archive_seed_default_agent(session, tenant_id)

    seeded_skill_ids = {
        str(content["skill_id"])
        for content in (
            REFUND_SKILL,
            EXCHANGE_SKILL,
            PURCHASE_SKILL,
            PRICE_COMPARE_SKILL,
            GRAPH_VISUAL_DEMO_SKILL,
        )
    }
    for skill in session.exec(
        select(Skill).where(Skill.tenant_id == tenant_id, Skill.skill_id.in_(seeded_skill_ids))
    ).all():
        ensure_open_gallery_binding(
            session,
            tenant_id,
            "skill",
            skill.id,
            "active" if skill.status == "published" else "inactive",
            metadata_json=creator_metadata,
        )

    seeded_tool_names = {str(config["name"]) for config in DEMO_TOOLS}
    for tool in session.exec(
        select(Tool).where(Tool.tenant_id == tenant_id, Tool.name.in_(seeded_tool_names))
    ).all():
        ensure_open_gallery_binding(
            session,
            tenant_id,
            "tool",
            tool.id,
            "active" if tool.enabled else "inactive",
            metadata_json=creator_metadata,
        )

    weather = session.exec(
        select(GeneralSkill).where(
            GeneralSkill.tenant_id == tenant_id, GeneralSkill.slug == "weather-zh"
        )
    ).first()
    if weather:
        weather.metadata_json = _system_seed_metadata(weather.metadata_json or {})
        session.add(weather)
        ensure_open_gallery_binding(
            session,
            tenant_id,
            "general_skill",
            weather.id,
            "active" if weather.status == "published" else "inactive",
            metadata_json=creator_metadata,
        )


def _ensure_seed_agents(session: Session) -> None:
    tenant_id = "tenant_demo"
    for agent_id, name, description, is_overall in (
        (f"agent_{tenant_id}_overall", "整體智能體", "全局資源池", True),
    ):
        existing = session.get(AgentProfile, agent_id)
        if existing:
            continue
        session.add(
            AgentProfile(
                id=agent_id,
                tenant_id=tenant_id,
                name=name,
                description=description,
                is_overall=is_overall,
                status="active",
            )
        )


def _archive_seed_default_agent(session: Session, tenant_id: str) -> None:
    default_agent = session.get(AgentProfile, f"agent_{tenant_id}_default")
    if not default_agent:
        return
    metadata = dict(default_agent.metadata_json or {})
    if metadata and not (
        metadata.get("is_default_employee") is True
        or metadata.get("created_by") == "admin"
        or metadata.get("owner_user_id") == "admin"
    ):
        return
    metadata.update(
        {
            "is_default_employee": True,
            "hidden_from_staffdeck": True,
            "archived_by_seed": True,
        }
    )
    default_agent.metadata_json = _system_seed_metadata(metadata)
    default_agent.status = "archived"
    default_agent.updated_at = utc_now()
    session.add(default_agent)


def _system_seed_metadata(extra: dict[str, object] | None = None) -> dict[str, object]:
    metadata = dict(extra or {})
    metadata.update(
        {
            "owner_user_id": "admin",
            "owner_username": "admin",
            "owner_display_name": "Administrator",
            "created_by_user_id": "admin",
            "created_by_username": "admin",
            "created_by": "admin",
            "created_by_display_name": "Administrator",
            "creator_name": "admin",
        }
    )
    return metadata


def _tool_config_with_base_url(tool_config: dict, base_url: str) -> dict:
    config = dict(tool_config)
    config["url"] = _tool_url_with_base(config["url"], base_url)
    return config


def _tool_url_with_base(url: str, base_url: str) -> str:
    stripped = url.strip()
    if stripped.startswith("/"):
        return f"{base_url}{stripped}"
    return stripped


def _seed_weather_general_skill(session: Session) -> None:
    folder_source = Path("/Users/hm/Downloads/maomao-weather-1.0.2")
    file_source = Path("/Users/hm/Downloads/SKILL.md")
    package_files = _collect_general_skill_folder(folder_source) if folder_source.exists() else []
    source = folder_source / "SKILL.md" if package_files else file_source
    if not source.exists():
        return
    try:
        markdown = source.read_text(encoding="utf-8").strip()
    except OSError:
        return
    if not markdown:
        return
    slug = "weather-zh"
    existing = session.exec(
        select(GeneralSkill).where(
            GeneralSkill.tenant_id == "tenant_demo",
            GeneralSkill.slug == slug,
        )
    ).first()
    if existing:
        needs_package_backfill = package_files and not (existing.skill_files_json or [])
        if (
            existing.skill_markdown != markdown
            or existing.status != "published"
            or needs_package_backfill
        ):
            existing.name = existing.name or "中國城市天氣"
            existing.description = existing.description or "中國城市天氣查詢工具"
            existing.homepage = existing.homepage or "https://www.weather.com.cn/"
            existing.skill_markdown = markdown
            if package_files:
                existing.skill_files_json = package_files
                existing.metadata_json = existing.metadata_json or {
                    "source": "maomao-weather-1.0.2"
                }
            existing.status = "published"
            existing.permissions_json = existing.permissions_json or {
                "network": True,
                "python": True,
            }
            existing.runtime_config_json = existing.runtime_config_json or {
                "runtime": "bash",
                "timeout_seconds": 12,
            }
            existing.updated_at = utc_now()
        return
    session.add(
        GeneralSkill(
            tenant_id="tenant_demo",
            slug=slug,
            name="中國城市天氣",
            description="中國城市天氣查詢工具",
            homepage="https://www.weather.com.cn/",
            skill_markdown=markdown,
            skill_files_json=package_files,
            metadata_json={"source": "maomao-weather-1.0.2"} if package_files else {},
            status="published",
            permissions_json={"network": True, "python": True},
            runtime_config_json={
                "runtime": "bash" if package_files else "python",
                "timeout_seconds": 12,
            },
        )
    )


def _collect_general_skill_folder(folder: Path) -> list[dict[str, object]]:
    skill_file = folder / "SKILL.md"
    if not skill_file.exists():
        return []
    files: list[dict[str, object]] = []
    for path in sorted(folder.rglob("*")):
        if not path.is_file() or path.name.startswith("."):
            continue
        try:
            content = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        except OSError:
            continue
        relative = path.relative_to(folder).as_posix()
        files.append(
            {
                "path": relative,
                "content": content,
                "size": len(content.encode("utf-8")),
                "mime_type": "text/markdown" if relative.lower().endswith(".md") else "text/plain",
            }
        )
    return files


def _sync_demo_skill_if_stale(existing: Skill, desired: dict) -> None:
    content = _skill_content_graph(dict(existing.content_json or {}))
    desired = _skill_content_graph(desired)
    changed = False
    current_nodes = [node for node in content.get("nodes", []) if isinstance(node, dict)]
    desired_nodes = [node for node in desired.get("nodes", []) if isinstance(node, dict)]
    current_nodes_by_id = {str(node.get("node_id") or ""): node for node in current_nodes}
    merged_nodes: list[dict] = []
    used_node_ids: set[str] = set()

    for desired_node in desired_nodes:
        node_id = str(desired_node.get("node_id") or "")
        current_node = current_nodes_by_id.get(node_id)
        if not current_node:
            merged_nodes.append(dict(desired_node))
            used_node_ids.add(node_id)
            changed = True
            continue
        desired_instruction = str(desired_node.get("instruction") or "")
        current_instruction = str(current_node.get("instruction") or "")
        if desired_instruction and not current_instruction:
            current_node["instruction"] = desired_instruction
            changed = True
        for key in (
            "type",
            "name",
            "expected_user_info",
            "allowed_actions",
            "knowledge_scope",
            "retry_policy",
            "optional",
            "condition",
            "metadata",
        ):
            if key in desired_node and current_node.get(key) != desired_node.get(key):
                current_node[key] = desired_node[key]
                changed = True
        merged_nodes.append(current_node)
        used_node_ids.add(node_id)

    for current_node in current_nodes:
        node_id = str(current_node.get("node_id") or "")
        if node_id and node_id not in used_node_ids:
            merged_nodes.append(current_node)
            used_node_ids.add(node_id)

    if desired_nodes and content.get("nodes") != merged_nodes:
        content["nodes"] = merged_nodes
        changed = True

    for graph_key in ("edges", "start_node_id", "terminal_node_ids"):
        if graph_key in desired and content.get(graph_key) != desired.get(graph_key):
            content[graph_key] = desired[graph_key]
            changed = True

    if desired.get("required_info") and content.get("required_info") != desired.get(
        "required_info"
    ):
        content["required_info"] = desired["required_info"]
        changed = True

    if desired.get("interruption_policy") and content.get("interruption_policy") != desired.get(
        "interruption_policy"
    ):
        content["interruption_policy"] = desired["interruption_policy"]
        changed = True
    if desired.get("slot_filling_policy"):
        merged_policy = _merge_slot_filling_policy(
            content.get("slot_filling_policy"), desired["slot_filling_policy"]
        )
        if content.get("slot_filling_policy") != merged_policy:
            content["slot_filling_policy"] = merged_policy
            changed = True
    if desired.get("response_rules"):
        merged_rules = _append_missing_rules(
            content.get("response_rules"), desired["response_rules"]
        )
        if content.get("response_rules") != merged_rules:
            content["response_rules"] = merged_rules
            changed = True

    if changed:
        existing.content_json = content
        existing.updated_at = utc_now()


def _skill_content_graph(content: dict) -> dict:
    next_content = dict(content or {})
    nodes = next_content.get("nodes") if isinstance(next_content.get("nodes"), list) else []
    node_ids = [str(node.get("node_id") or "") for node in nodes if isinstance(node, dict)]
    node_ids = [node_id for node_id in node_ids if node_id]
    if node_ids:
        next_content.setdefault("start_node_id", node_ids[0])
        next_content.setdefault("terminal_node_ids", [node_ids[-1]])
        next_content.setdefault(
            "edges",
            [
                {
                    "source_node_id": source,
                    "next_node_id": target,
                    "condition": "",
                    "priority": index,
                    "label": "",
                }
                for index, (source, target) in enumerate(zip(node_ids, node_ids[1:]))
            ],
        )
    else:
        next_content.setdefault("nodes", [])
        next_content.setdefault("edges", [])
        next_content.setdefault("start_node_id", "")
        next_content.setdefault("terminal_node_ids", [])
    return next_content


def _merge_slot_filling_policy(current: object, desired: dict) -> dict:
    current_policy = dict(current) if isinstance(current, dict) else {}
    merged = {**current_policy, **desired}
    target_info = {str(item) for item in current_policy.get("target_info", []) if str(item).strip()}
    target_info.update(str(item) for item in desired.get("target_info", []) if str(item).strip())
    merged["target_info"] = sorted(target_info)
    return merged


def _append_missing_rules(current: object, desired: list[str]) -> list[str]:
    rules = [str(item) for item in current] if isinstance(current, list) else []
    for rule in desired:
        if rule not in rules:
            rules.append(rule)
    return rules
