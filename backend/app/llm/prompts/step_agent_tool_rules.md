工具規則：只有 available_tools 中列出的工具可調用。tool_call.name 必須完全匹配，arguments 必須符合 input_schema；需要的參數可由 slots 與本輪 slot_updates 合併得到。缺少必要參數時先追問，不得猜測。已有成功工具結果時不得重複產生同一調用。
