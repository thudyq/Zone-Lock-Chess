import re
import sys
from pathlib import Path

PROJECT = Path("/mnt/d/Coding for VS Code/Zone-Lock-Chess")


def read_text(path):
    return path.read_text(encoding="utf-8")


def write_text(path, text):
    path.write_text(text, encoding="utf-8")


# ==================== JavaScript helpers ====================

def replace_section_comments_js(text):
    """Convert section separators to the required format."""
    replacements = {
        "// ----- 新增：重置颜色选择阶段 -----": "// ==================== 重置颜色选择阶段 ====================",
        "// ----- 保存旧状态，用于变化检测 -----": "// ==================== 保存旧状态 ====================",
        "// ----- 更新全局变量（新状态）-----": "// ==================== 更新全局变量 ====================",
        "// ========== 离开检测 ==========": "// ==================== 离开检测 ====================",
        "// ----- 检测是否有变化 -----": "// ==================== 检测变化 ====================",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return text


def remove_js_function(text, name):
    """Remove a top-level function declaration by name."""
    pattern = re.compile(rf"^function\s+{re.escape(name)}\s*\([^)]*\)\s*\{{", re.MULTILINE)
    match = pattern.search(text)
    if not match:
        return text
    start = match.start()
    brace_start = match.end() - 1  # position of '{'
    depth = 0
    i = brace_start
    while i < len(text):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                # consume following blank lines
                while end < len(text) and text[end] == "\n":
                    end += 1
                return text[:start] + text[end:]
        i += 1
    return text


def fix_server_js():
    path = PROJECT / "server.js"
    text = read_text(path)

    # Remove unused 'status' variable in getRoomState
    text = re.sub(
        r"\n    const status = room\.players\.length < 2 \? \"waiting\" : room\.gameOver \? \"finished\" : \"playing\";\n",
        "\n",
        text,
    )

    # Remove unused 'color' variable in /join-room
    text = re.sub(
        r"\n                const color = room\.players\.length === 0 \? 1 : 2;\n",
        "\n",
        text,
    )

    # Rename local literal constants to UPPER_SNAKE_CASE
    text = text.replace("const contentTypes = {", "const CONTENT_TYPES = {")
    text = text.replace("contentTypes[ext]", "CONTENT_TYPES[ext]")
    text = text.replace("const chars = \"ABCDEFGHJKLMNPQRSTUVWXYZ23456789\";", "const CHARS = \"ABCDEFGHJKLMNPQRSTUVWXYZ23456789\";")
    text = text.replace("code += chars[Math.floor(Math.random() * chars.length)];", "code += CHARS[Math.floor(Math.random() * CHARS.length)];")
    text = text.replace("const directions = [", "const DIRECTIONS = [")
    text = text.replace("for (const [dr, dc] of directions) {", "for (const [dr, dc] of DIRECTIONS) {")
    text = text.replace("const validSizes = [6, 8, 10, 12];", "const VALID_SIZES = [6, 8, 10, 12];")
    text = text.replace("if (!validSizes.includes(newSize)) {", "if (!VALID_SIZES.includes(newSize)) {")

    # Convert section comments
    text = replace_section_comments_js(text)

    # Add defensive body check to /choose-color endpoint before destructuring
    old_choose = """        if (pathname === \"/choose-color\" && method === \"POST\") {
            parseBody(req, (body) => {
                const { code, playerId, color } = body;"""
    new_choose = """        if (pathname === \"/choose-color\" && method === \"POST\") {
            parseBody(req, (body) => {
                if (!body) {
                    res.writeHead(400, { \"Content-Type\": \"application/json\" });
                    res.end(JSON.stringify({ error: \"缺少参数\" }));
                    return;
                }

                const { code, playerId, color } = body;"""
    text = text.replace(old_choose, new_choose)

    write_text(path, text)


def fix_script_js():
    path = PROJECT / "script.js"
    text = read_text(path)

    # Remove unused local channel / sync variables
    text = re.sub(r"\nlet localChannel = null;\n", "\n", text)
    text = re.sub(r"let localSyncEnabled = false;\n", "", text)

    # Remove duplicate assignments in initializeGame
    old_init = """    } else {
        userColor = PLAYER_BLACK;
        aiColor = PLAYER_WHITE;
    }
    currentPlayer = PLAYER_BLACK;
    gameOver = false;

    updateModeSpecificUI();"""
    new_init = """    } else {
        userColor = PLAYER_BLACK;
        aiColor = PLAYER_WHITE;
    }

    updateModeSpecificUI();"""
    text = text.replace(old_init, new_init)

    # Remove dead updateOnlineStatusText function
    text = remove_js_function(text, "updateOnlineStatusText")

    # Rename local literal constants
    text = text.replace("const hostCandidates = [", "const HOST_CANDIDATES = [")
    text = text.replace("for (const host of hostCandidates) {", "for (const host of HOST_CANDIDATES) {")
    text = text.replace("const ports = [", "const PORTS = [")
    text = text.replace("for (const port of ports) {", "for (const port of PORTS) {")

    # Optimize exportRecord to use a single Date instance
    old_export = """    const dateStr = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const secs = String(now.getSeconds()).padStart(2, '0');"""
    new_export = """    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const secs = String(now.getSeconds()).padStart(2, "0");"""
    text = text.replace(old_export, new_export)

    # Convert section comments
    text = replace_section_comments_js(text)

    write_text(path, text)


# ==================== CSS helpers ====================

PROPERTY_ORDER = [
    # Position / display / box-model
    "position", "inset", "top", "right", "bottom", "left", "z-index",
    "box-sizing", "display", "float", "clear",
    "flex", "flex-flow", "flex-direction", "flex-wrap", "justify-content",
    "align-content", "align-items", "align-self", "order", "flex-grow",
    "flex-shrink", "flex-basis", "gap", "row-gap", "column-gap",
    "grid", "grid-area", "grid-auto-columns", "grid-auto-flow", "grid-auto-rows",
    "grid-column", "grid-column-end", "grid-column-start", "grid-row", "grid-row-end",
    "grid-row-start", "grid-template", "grid-template-areas", "grid-template-columns",
    "grid-template-rows", "place-content", "place-items", "place-self",
    "width", "min-width", "max-width", "height", "min-height", "max-height",
    "aspect-ratio", "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
    "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
    "overflow", "overflow-x", "overflow-y",
    # Visual / background / border
    "background", "background-attachment", "background-blend-mode", "background-clip",
    "background-color", "background-image", "background-origin", "background-position",
    "background-position-x", "background-position-y", "background-repeat", "background-size",
    "border", "border-top", "border-right", "border-bottom", "border-left",
    "border-width", "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
    "border-style", "border-top-style", "border-right-style", "border-bottom-style", "border-left-style",
    "border-color", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
    "border-radius", "border-top-left-radius", "border-top-right-radius",
    "border-bottom-right-radius", "border-bottom-left-radius",
    "outline", "box-shadow", "filter", "backdrop-filter", "opacity", "visibility", "clip",
    "transform", "transform-origin", "transform-style", "perspective", "perspective-origin",
    "backface-visibility",
    # Text
    "color", "font", "font-family", "font-feature-settings", "font-kerning", "font-optical-sizing",
    "font-size", "font-stretch", "font-style", "font-synthesis", "font-variant", "font-variant-caps",
    "font-variant-east-asian", "font-variant-ligatures", "font-variant-numeric", "font-variation-settings",
    "font-weight", "line-height", "letter-spacing", "text-align", "text-align-last", "text-decoration",
    "text-decoration-color", "text-decoration-line", "text-decoration-style", "text-decoration-thickness",
    "text-indent", "text-justify", "text-orientation", "text-overflow", "text-shadow", "text-transform",
    "text-underline-offset", "text-underline-position", "white-space", "word-break", "word-spacing",
    "word-wrap", "overflow-wrap", "vertical-align", "writing-mode", "direction", "unicode-bidi",
    "list-style", "list-style-image", "list-style-position", "list-style-type",
    # Animation / transition
    "animation", "animation-delay", "animation-direction", "animation-duration", "animation-fill-mode",
    "animation-iteration-count", "animation-name", "animation-play-state", "animation-timing-function",
    "transition", "transition-delay", "transition-duration", "transition-property", "transition-timing-function",
    "will-change", "cursor",
]

PROPERTY_RANK = {name: idx for idx, name in enumerate(PROPERTY_ORDER)}


def rank(prop):
    base = prop.split("-")[0]
    return PROPERTY_RANK.get(prop, PROPERTY_RANK.get(base, 9999))


def reorder_declarations(declarations):
    """Reorder a list of (property, value) declarations by category."""
    # Preserve original order within the same rank
    return sorted(declarations, key=lambda item: (rank(item[0]), declarations.index(item)))


def format_declaration(prop, value):
    value = value.strip()
    # Single-line transition values for readability
    if prop == "transition" and "\n" in value:
        value = re.sub(r"\s+", " ", value.replace("\n", " ")).strip()
    return f"{prop}: {value};"


def process_css_rule_body(body):
    """Reorder declarations inside a rule body (between { and })."""
    declarations = []
    comments = []
    i = 0
    n = len(body)
    while i < n:
        # skip leading whitespace/newline
        if body[i] in " \t\n":
            i += 1
            continue
        # block comment
        if body.startswith("/*", i):
            end = body.find("*/", i + 2)
            if end == -1:
                comments.append((i, n, body[i:]))
                break
            comments.append((i, end + 2, body[i : end + 2]))
            i = end + 2
            continue
        # declaration: find semicolon
        semi = body.find(";", i)
        if semi == -1:
            break
        decl = body[i:semi].strip()
        if decl:
            colon = decl.find(":")
            if colon != -1:
                prop = decl[:colon].strip()
                val = decl[colon + 1 :].strip()
                declarations.append((prop, val))
        i = semi + 1

    reordered = reorder_declarations(declarations)
    result_parts = []
    for prop, val in reordered:
        result_parts.append(format_declaration(prop, val))
    result = "\n    ".join(result_parts)
    if comments:
        # place standalone comments before the result, indented
        comment_text = "\n    ".join(c.strip() for _, _, c in comments)
        if result:
            result = comment_text + "\n    " + result
        else:
            result = comment_text
    return result


def process_css(text):
    result = []
    i = 0
    n = len(text)
    while i < n:
        # Pass through comments at top level unchanged if they are already formatted,
        # otherwise convert section comments.
        if text.startswith("/*", i):
            end = text.find("*/", i + 2)
            if end != -1:
                comment = text[i : end + 2]
                result.append(convert_css_section_comment(comment))
                i = end + 2
                continue
            else:
                result.append(text[i:])
                break
        # Rule starts with selector
        brace = text.find("{", i)
        if brace == -1:
            result.append(text[i:])
            break
        selector = text[i:brace].strip()
        # find matching closing brace
        depth = 1
        j = brace + 1
        while j < n and depth > 0:
            if text[j] == "{":
                depth += 1
            elif text[j] == "}":
                depth -= 1
            j += 1
        body = text[brace + 1 : j - 1]
        close_brace = text[j - 1 : j]

        if selector.startswith("@keyframes") or selector.startswith("@font-face") or selector.startswith("@supports"):
            # keep inner content as-is
            result.append(selector + " {\n" + body + "}")
        elif selector.startswith("@media") or selector.startswith("@layer"):
            # process nested rules recursively
            inner = process_css(body)
            result.append(selector + " {\n" + inner + "}")
        else:
            reordered_body = process_css_rule_body(body)
            result.append(selector + " {\n    " + reordered_body + "\n}")
        i = j
    return "".join(result)


def convert_css_section_comment(comment):
    s = comment.strip("/*").strip("*/").strip()
    # already formatted?
    if re.fullmatch(r"=+\s.*\s=+", s):
        return f"/* {s} */"
    return f"/* ==================== {s} ==================== */"


def fix_css():
    path = PROJECT / "style.css"
    text = read_text(path)
    # Preserve :root and .dark variable blocks (do not reorder custom properties)
    # We'll split them out, process the rest, and re-insert.
    root_match = re.search(r"(:root\s*\{[^}]*\})", text, re.DOTALL)
    dark_match = re.search(r"(\.dark\s*\{[^}]*\})", text, re.DOTALL)

    # Convert comments inside variable blocks
    def convert_comments_in_block(block):
        lines = block.splitlines()
        out = []
        for line in lines:
            stripped = line.strip()
            if stripped.startswith("/*") and stripped.endswith("*/"):
                out.append("    " + convert_css_section_comment(stripped))
            else:
                out.append(line)
        return "\n".join(out)

    if root_match:
        root_block = convert_comments_in_block(root_match.group(1))
        text = text[: root_match.start()] + "__ROOT_BLOCK__" + text[root_match.end() :]
    else:
        root_block = None

    if dark_match:
        # recompute after substitution
        dark_match = re.search(r"(\.dark\s*\{[^}]*\})", text, re.DOTALL)
        if dark_match:
            dark_block = convert_comments_in_block(dark_match.group(1))
            text = text[: dark_match.start()] + "__DARK_BLOCK__" + text[dark_match.end() :]
        else:
            dark_block = None
    else:
        dark_block = None

    text = process_css(text)

    if root_block:
        text = text.replace("__ROOT_BLOCK__", root_block, 1)
    if dark_block:
        text = text.replace("__DARK_BLOCK__", dark_block, 1)

    # Clean up blank lines: ensure exactly one blank line between top-level rules
    text = re.sub(r"\n{3,}", "\n\n", text)

    write_text(path, text)


def main():
    fix_server_js()
    fix_script_js()
    fix_css()


if __name__ == "__main__":
    main()
