# One-off: restore Chinese text where U+FFFD replaced mojibake-corrupted UTF-8 bytes.
from pathlib import Path

PATH = Path(__file__).resolve().parents[1] / "src/pages/KnowledgeBase/Detail/KnowledgeDetail.jsx"

# Order matters: longer / more specific replacements first.
REPLACEMENTS = [
    # Block comment header (line ~18)
    (
        "（UPLOADING / PENDING / \ufffd?/ EMBEDDING / COMPLETED 等）\ufffd? * 未识别的历史枚举仍归为「处理中」，rawForTitle 悬停可看原始值\ufffd? */",
        "（UPLOADING / PENDING / READY / EMBEDDING / COMPLETED 等）。 * 未识别的历史枚举仍归为「处理中」，rawForTitle 悬停可看原始值。 */",
    ),
    # Long react-markdown comment (~224)
    (
        "* react-markdown 默认 defaultUrlTransform 不允\ufffd?data:/blob:，内\ufffd?base64 图片\ufffd?src 会被清空\ufffd? * \ufffd?default 逻辑一致，仅额外放\ufffd?data、blob\ufffd? */",
        "* react-markdown 默认 defaultUrlTransform 不允许 data:/blob:，内联 base64 图片的 src 会被清空。与 default 逻辑一致，仅额外放行 data、blob。 */",
    ),
    (
        "/** 后端若返\ufffd?processingProgress / progress\ufffd?\ufffd?00）则优先使用；否则按主链路阶段估算条形宽\ufffd?*/",
        "/** 后端若返回 processingProgress / progress 等（0–100）则优先使用；否则按主链路阶段估算条形宽度 */",
    ),
    ("'可使\ufffd?,", "'可使用',"),
    ("'处理\ufffd?,", "'处理中',"),
    ("'已停\ufffd?,", "'已停用',"),
    ("'已删\ufffd?,", "'已删除',"),
    ("{ label: '处理\ufffd? }),", "{ label: '处理中' }),"),
    ("{ label: '已删\ufffd? })", "{ label: '已删除' })"),
    ("label: '处理\ufffd?, rawForTitle:", "label: '处理中', rawForTitle:"),
    ("'处理\ufffd?,", "'处理中',"),
    ("/** 文档\ufffd?EMBEDDING 时", "/** 文档在 EMBEDDING 时"),
    ("'上传与记录创\ufffd?,", "'上传与记录创建',"),
    ("'转 PDF（预留）'", "'转 PDF（预留）'"),  # line 215 might be '\ufffd?PDF' -> 转
    ("'\\ufffd?PDF（预留）',", "'转 PDF（预留）',"),
    ("'分页预览\ufffd?,", "'分页预览图',"),
    ("'解析与分\ufffd?,", "'解析与分段',"),
    ("'建立检索索\ufffd?", "'建立检索索引'"),
    ("这里做一次清\ufffd?", "这里做一次清理"),
    ("attachment:xxx\ufffd?", "attachment:xxx）"),
    ("base64,...\ufffd?()", "base64,... 在 ()"),
    ("压平成一\ufffd?", "压平成一行"),
    ("'正在准备上传\ufffd?", "'正在准备上传…"),
    ("`已传\ufffd?", "`已传 "),
    ("'正在上传，请稍候\ufffd?", "'正在上传，请稍候…"),
    ("多等片刻\ufffd?", "多等片刻…"),
    ("'处理完成，正在刷新列表\ufffd?", "'处理完成，正在刷新列表…"),
    ("不显示加载\ufffd?", "不显示加载态"),
    ("挂载大\ufffd?DOM", "挂载大量 DOM"),
    ("窗口出现\ufffd?", "窗口出现延迟"),
    ("文档列\ufffd?1)", "文档列表(1)"),
    ("(1) \ufffd?切片列表", "(1) 与切片列表"),
    ("对应请\ufffd?", "对应请求"),
    ("乘 previewZoom\ufffd?", "乘 previewZoom）"),
    ("仅保留当\ufffd?previewPage", "仅保留当前 previewPage"),
    ("避免多\ufffd?base64", "避免多页 base64"),
    ("“加载中\ufffd?", "“加载中”"),
    ("上一\ufffd?下一\ufffd?", "上一页/下一页"),
    ("\ufffd?loadingPages 同步", "与 loadingPages 同步"),
    ("重复请\ufffd?", "重复请求"),
    ("过期响\ufffd?", "过期响应"),
    ("重新渲\ufffd?", "重新渲染"),
    ("对每\ufffd?docId", "对每个 docId"),
    ("信息失\ufffd?", "信息失败"),
    ("区域 1 同显\ufffd?", "区域 1 同显时"),
    ("挂载过\ufffd?DOM", "挂载过多 DOM"),
    ("弹出\ufffd?", "弹出延迟"),
    ("占用内\ufffd?", "占用内存"),
    ("（区\ufffd?3）", "（区域 3）"),
    ("不缓存多页\ufffd?", "不缓存多页）"),
    ("缺\ufffd?id", "缺少 id"),
    ("更新状\ufffd?", "更新状态"),
    ("状态失\ufffd?", "状态失败"),
    ("移除该文\ufffd?", "移除该文档"),
    ("选中状\ufffd?", "选中状态"),
    ("删除失败\ufffd?", "删除失败："),
    ("第一\ufffd?", "第一页"),
    ("刷新失败\ufffd?", "刷新失败："),
    ("回退\ufffd?click", "回退到 click"),
    ("文\ufffd?", "文件："),
    ("'上传已取\ufffd?", "'上传已取消"),
    ("创建失败\ufffd?", "创建失败："),
    ("获取文件扩展\ufffd?", "获取文件扩展名"),
    ("文件\ufffd?", "文件名"),
    ("获取图\ufffd?", "获取图标"),
    ("加载\ufffd?..", "加载中..."),
    ("知识库详\ufffd?", "知识库详情"),
    ("恢复列\ufffd?", "恢复列表"),
    ("{loadingDocs ? '\ufffd? : '\ufffd?}", "{loadingDocs ? '⟳' : '↻'}"),
    ("加载更\ufffd?", "加载更多"),
    ("处理\ufffd?/span>", "处理中</span>"),
    ("'处理中\ufffd? : '重新处理'", "'处理中…' : '重新处理'"),
    ("加载\ufffd?.", "加载中..."),
    ("没有更多\ufffd?", "没有更多了"),
    ("分块侧\ufffd?", "分块侧栏"),
    ("上一\ufffd?", "上一页"),
    ("下一\ufffd?", "下一页"),
    ("\ufffd?<strong>{previewPage}</strong> \ufffd?/ \ufffd?<strong>{totalPreviewPages || '-'}</strong> \ufffd?",
     "第 <strong>{previewPage}</strong> 页 / 共 <strong>{totalPreviewPages || '-'}</strong> 页"),
    ("                  \ufffd?                </button>", "                  −                </button>"),
    ("加载页数\ufffd?..", "加载页数据..."),
    ("alt={`\ufffd?${pageNum} 页`}", "alt={`第 ${pageNum} 页`}"),
    ("加载\ufffd?..</span>", "加载中...</span>"),
    ("\ufffd?{pageNum} \ufffd?/span>", "第 {pageNum} 页</span>"),
    ("查\ufffd?", "查看"),
    ("\ufffd? 返回", "← 返回"),
    ("一篇文\ufffd?", "一篇文档"),
    ("分块中\ufffd?", "分块中…"),
    ("暂无分\ufffd?", "暂无分块"),
    ("                        : '\ufffd?",
        "                        : '—'"),
    ("（chunkIndex\ufffd?>", "（chunkIndex）"),
    ("字节\ufffd?>", "字节数"),
    ("无分\ufffd?ID", "无分块 ID"),
    ("'处理中\ufffd? : '停用'", "'处理中…' : '停用'"),
    ("'处理中\ufffd? : '启用'", "'处理中…' : '启用'"),
    ("窗口出现\ufffd?", "窗口出现延迟"),
    ("加载中\ufffd?", "加载中..."),
    ("文档描\ufffd?", "文档描述"),
    ("自动识\ufffd?", "自动识别"),
    ("自动填\ufffd?", "自动填充"),
    ("启用该文\ufffd?", "启用该文档"),
    ("'上传中\ufffd? : '保存'", "'上传中…' : '保存'"),
    ("对话\ufffd?", "对话框"),
    ("文档吗\ufffd?", "文档吗？"),
    ("操作\ufffd?", "操作。"),
    ("'删除中\ufffd? : '确认删除'", "'删除中…' : '确认删除'"),
]

# Standalone broken comment line (wrong encoding, not U+FFFD)
LINE_659_FIX = (
    "  // ʹ���ĵ��ϵ� totalPages�����ٵ���������ҳ��",
    "  // 使用文档上的 totalPages，不再单独请求总页数",
)


def main() -> None:
    text = PATH.read_text(encoding="utf-8")
    n0 = text.count("\ufffd")
    for old, new in REPLACEMENTS:
        if old not in text:
            # allow skip if already fixed
            continue
        text = text.replace(old, new)
    if LINE_659_FIX[0] in text:
        text = text.replace(LINE_659_FIX[0], LINE_659_FIX[1])
    n1 = text.count("\ufffd")
    PATH.write_text(text, encoding="utf-8")
    print(f"U+FFFD: {n0} -> {n1}")
    if n1:
        # show remaining
        idx = 0
        while True:
            i = text.find("\ufffd", idx)
            if i == -1:
                break
            print("remaining:", repr(text[max(0, i - 30) : i + 30]))
            idx = i + 1


if __name__ == "__main__":
    main()
