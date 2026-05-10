from PIL import Image, ImageDraw, ImageFont
import os, math

W, H = 2500, 1686

bg = Image.open(os.path.expanduser('~/Desktop/shutterstock_1212419833.jpg')).convert('RGBA')
bg = bg.resize((W, H), Image.LANCZOS)
overlay = Image.new('RGBA', (W, H), (0, 0, 0, 150))
base = Image.alpha_composite(bg, overlay)
draw = ImageDraw.Draw(base)

col_w = W // 3
row_h = H // 2
cells = [
    (0,       0,     col_w,   row_h),
    (col_w,   0,     col_w*2, row_h),
    (col_w*2, 0,     W,       row_h),
    (0,       row_h, col_w,   H),
    (col_w,   row_h, col_w*2, H),
    (col_w*2, row_h, W,       H),
]
buttons = ['スケジュール', 'チーム編成', '新規登録', 'マイページ', '共有資料', '管理']

label_font = None
for fp in [
    '/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc',
    '/System/Library/Fonts/Hiragino Sans GB.ttc',
]:
    if os.path.exists(fp):
        try: label_font = ImageFont.truetype(fp, 88); break
        except: pass
if label_font is None:
    label_font = ImageFont.load_default()

WHITE = (255, 255, 255, 255)
LW = 14

def draw_calendar(draw, cx, cy, s=120):
    x0, y0, x1, y1 = cx-s, cy-s, cx+s, cy+s
    draw.rounded_rectangle([x0, y0+30, x1, y1], radius=18, outline=WHITE, width=LW)
    draw.line([x0, y0+80, x1, y0+80], fill=WHITE, width=LW)
    for px in [cx-s//2, cx+s//2]:
        draw.line([px, y0, px, y0+50], fill=WHITE, width=LW)
    for row in range(2):
        for col in range(3):
            dx = cx - 70 + col * 70
            dy = cy + 10 + row * 65
            draw.ellipse([dx-10, dy-10, dx+10, dy+10], fill=WHITE)

def draw_team(draw, cx, cy, s=110):
    head_r = 28
    for px, py in [(cx, cy-s//2), (cx-s, cy-s//2+30), (cx+s, cy-s//2+30)]:
        draw.ellipse([px-head_r, py-head_r, px+head_r, py+head_r], outline=WHITE, width=LW)
        draw.arc([px-head_r*2, py+head_r, px+head_r*2, py+head_r*4], start=0, end=180, fill=WHITE, width=LW)

def draw_person_plus(draw, cx, cy, s=110):
    head_r = 32
    head_cy = cy - s//2
    draw.ellipse([cx-head_r-30, head_cy-head_r, cx+head_r-30, head_cy+head_r], outline=WHITE, width=LW)
    draw.arc([cx-head_r*2-30, head_cy+head_r, cx+head_r*2-30, head_cy+head_r*4], start=0, end=180, fill=WHITE, width=LW)
    px, py, ps = cx+s//2, cy-s//4, 40
    draw.line([px-ps, py, px+ps, py], fill=WHITE, width=LW)
    draw.line([px, py-ps, px, py+ps], fill=WHITE, width=LW)

def draw_mypage(draw, cx, cy, s=110):
    head_r = 38
    head_cy = cy - s//3
    draw.ellipse([cx-head_r, head_cy-head_r, cx+head_r, head_cy+head_r], outline=WHITE, width=LW)
    draw.arc([cx-head_r*2, head_cy+head_r, cx+head_r*2, head_cy+head_r*4], start=0, end=180, fill=WHITE, width=LW)

def draw_document(draw, cx, cy, s=110):
    x0, y0, x1, y1 = cx-s+20, cy-s, cx+s-20, cy+s
    fold = 55
    draw.polygon([(x0,y0),(x1-fold,y0),(x1,y0+fold),(x1,y1),(x0,y1)], outline=WHITE, width=LW)
    draw.line([x1-fold, y0, x1-fold, y0+fold, x1, y0+fold], fill=WHITE, width=LW)
    for i in range(3):
        ly = y0 + fold + 60 + i * 65
        draw.line([x0+30, ly, x1-30, ly], fill=WHITE, width=LW)

def draw_admin(draw, cx, cy, s=110):
    """歯車アイコン（管理）"""
    teeth = 8
    r_out = s
    r_mid = int(s * 0.78)
    r_in  = int(s * 0.45)
    pts = []
    for i in range(teeth * 2):
        angle = math.pi * i / teeth - math.pi / 2
        r = r_out if i % 2 == 0 else r_mid
        pts.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
    draw.polygon(pts, outline=WHITE, width=LW)
    draw.ellipse([cx-r_in, cy-r_in, cx+r_in, cy+r_in], outline=WHITE, width=LW)

icon_funcs = [draw_calendar, draw_team, draw_person_plus, draw_mypage, draw_document, draw_admin]

BORDER = (255, 255, 255, 70)

for i, ((x1, y1, x2, y2), label, icon_fn) in enumerate(zip(cells, buttons, icon_funcs)):
    cx = (x1 + x2) // 2
    cy = (y1 + y2) // 2
    draw.rectangle([x1+6, y1+6, x2-6, y2-6], outline=BORDER, width=3)
    if icon_fn:
        icon_fn(draw, cx, cy - 60)
    if label:
        try:
            lb = label_font.getbbox(label)
            lw = lb[2] - lb[0]
            draw.text((cx - lw//2, cy + 110), label, font=label_font, fill=WHITE)
        except:
            draw.text((cx - 100, cy + 110), label, font=label_font, fill=WHITE)

out = base.convert('RGB')
out_path = os.path.expanduser('~/Desktop/richmenu.jpg')
out.save(out_path, 'JPEG', quality=95)
print('保存完了:', out_path)
