# Scenario D — UGC / Live-Presenter Product Showcase

**Trigger**: The user needs a video with a real person presenting products on camera — review, testing, talking-head endorsement, 带货口播. The goal is authentic UGC (User-Generated Content) feel, not a polished commercial.

**Difference from Scenario C**: Scenario C is cinematic and music-driven (no talking). Scenario D is driven by a live presenter speaking to camera with dialogue and choreographed demo actions — and it must feel like a genuine user sharing their experience, not an actor reading a script.

---

## Phase 1.5: Asset Pre-Upload (Scenario D Only)

Upload all assets **before writing the prompt**. Material IDs must be known before prompt construction.

**1. Person image → upload as material**

The presenter face is used directly as `ID:ref_image` — on the seedance series it is auto-facepassed on submit, so there is no registration step. Reuse the **same material ID** across every segment to keep the presenter consistent.

If the user provided a presenter face image:
```bash
node renoise-cli.mjs material upload <person_image_path>
# → returns material_id; use as ID:ref_image
```

If the user did NOT provide a presenter image: ask what kind of presenter they want (gender, age, style, vibe — e.g. "甜美少女风", "职场精英感", "邻家小姐姐"). Generate a portrait with nano-banana-2, download it, and upload it. Present to user for approval before proceeding.

```bash
node renoise-cli.mjs task generate \
  --model nano-banana-2 --resolution 2k --ratio 1:1 \
  --prompt "<portrait prompt>"
curl -s -o presenter.png "<generated_image_url>"
node renoise-cli.mjs material upload presenter.png
# → returns material_id; use as ID:ref_image
```

**2. Product images → upload as material**

```bash
node renoise-cli.mjs material upload <product_image_path>
# → returns material_id; role will be ref_image
```

**3. Record all IDs**, then proceed to Phase 2.

---

## Core Mindset — UGC vs. Commercial

The single biggest failure mode for Scenario D is writing prompts that sound like TV commercials.

| Commercial (avoid) | UGC (target) |
|--------------------|--------------|
| "这款粉底持妆一整天，效果非常棒！" | "比我想象的稀一点…但上脸居然不错诶" |
| Perfect skin, flawless lighting | Natural skin texture, pores and blemishes visible |
| Professional fixed-camera setup | Handheld phone selfie, slight sway, ring light or window light |
| Smooth scripted delivery | Fast, casual, with hesitations and real reactions |
| Only highlights benefits | Mentions 1–2 honest flaws — this increases trust |
| Vague: "展示产品" | Specific: pump product onto cheek, half-face apply, press finger to skin |

---

## Hook Strategy — Choose One for the Opening 3 Seconds

| Hook Type | Best for | How to write in prompt |
|-----------|----------|------------------------|
| **Pain-point visual** | Products that solve a visible problem | Person opens with the problem state (bare face with skin issues, ill-fitting clothes, cheap dupe next to the real thing), then states the test |
| **Social-proof reply** | Trending / much-requested products | On-screen comment sticker with a viewer question + person responds directly to camera ("你们让我测，我来了") |
| **Skeptic-to-believer** | Products with bold or hard-to-believe claims | Person raises product, voice skeptical, immediately starts using it — the doubt IS the hook |

---

## Demo Action Framework

**The rule**: every selling-point claim must map to one physical, visible action. Never describe a claim abstractly — show the proof.

| Claim Type | Universal Demo Action | Product Examples |
|------------|----------------------|-----------------|
| **质地 / 材质** | Touch, stretch, scrunch, or pour the product; show its physical behavior | Foundation: pump onto cheek, let it flow. Fabric: scrunch in fist then release, show it recovers. Skincare: spread on back of hand, show absorption speed |
| **显色 / 遮瑕 / 色彩** | Apply to one side only; leave the other side bare as in-frame contrast | Foundation: half-face. Blush: single cheek swatch vs. bare. Lipstick: half-lip. Clothing: hold against skin in natural vs. artificial light |
| **持妆 / 耐久 / 不变形** | Timestamp reveal + show product/outfit condition after elapsed time | Foundation: wrist watch close-up after 12h. Clothing: same-day outfit after a full day. Bag: interior/exterior after heavy use |
| **版型 / 贴合 / 尺码** | Wear it and move — sit down, spin, stretch, raise arms, walk away from camera | Clothing: full 360° spin + squat. Shoes: walk in frame, flex foot. Pants: raise arms to test waistband rise |
| **细节 / 工艺 / 做工** | Extreme close-up while fingers explore the surface, seam, hardware, or finish | Clothing: fingers along stitching. Bag: open/close zipper, press hardware. Jewelry: rotate under light to show facets |
| **效果对比 / 改变** | Before ↔ after in the same continuous shot, no cut | Skincare: arm without vs. with product. Hair tool: one section before, one section after |
| **使用感受 / 真实反应** | Capture the first-use reaction — surprise, hesitation, discovery | First bite of food. First smell of fragrance. Feeling fabric for the first time. Putting on shoes and walking for the first time |

---

> Physical Continuity Rule and Action Granularity Rule apply here — see `INDEX.md` Phase 2.

---

## UGC Authenticity Principles

1. **Lead with a relatable imperfection**: open on a real problem the target audience has. Acne for makeup, poor fit history for clothing, cheap-looking alternatives for accessories. The viewer must think "that's me."
2. **Embed one honest flaw**: name a real drawback ("会有点氧化" / "版型稍微宽一点点" / "比我预期的稀") — this single admission dramatically raises trust in everything else.
3. **Keep unscripted reactions**: micro-reactions like "比我想象的…" / "没想到居然…" / "等等，这个…" — the hesitation IS the credibility.
4. **Use third-party proof**: watch timestamp, scale reading, measurement tape, or side-by-side size comparison — more convincing than any verbal claim.
5. **Mix other brands / context items**: 1–2 non-promoted items (a different brand's primer, a basic wardrobe piece) signal "this is my real life, not a paid set."
6. **Casual presenter appearance**: relatable hair, home clothes, simple backdrop reinforces "real person sharing a find."
7. **English UGC dialogue: discovery over declaration** — dialogue must sound like the presenter is figuring it out in real time, not announcing a conclusion. Use incomplete sentences, mid-action surprise, understated reactions:

   | ❌ Commercial (avoid) | ✅ UGC (target) |
   |---|---|
   | "They say this won't look chalky and lasts all day" | "Okay I keep hearing this one doesn't go white on you... let's actually check." |
   | "It just melts into my skin" | "Oh wait — it's actually blending? Like, properly?" |
   | "I'm actually convinced" | "Huh. Okay. That's... not bad at all." |
   | "This fabric has amazing stretch and recovery" | "I'm gonna squat in this. Right now. — okay yeah that worked." |
   | "The wear time on this is incredible" | "It's been like six hours. I keep checking and there's nothing. Nothing." |

   **The rule**: if the sentence could appear in a brand ad, rewrite it. Real people notice things, react, and move on — they don't narrate selling points.

---

## Six-Dimension Emphasis for UGC

| Dimension | UGC Emphasis | Requirements |
|-----------|--------------|--------------|
| Subject | Person appears natural, no heavy-beauty-filter feel; product held casually | Anchor person via `@person image` asset; anchor product via `@product image`; describe as natural/no-filter |
| Selling-Point Action | Second-by-second demo timeline using the Demo Action Framework | Min. 2 concrete demo actions; at least one honest-flaw or unscripted-reaction moment |
| Scene & Tone | Bedroom, bathroom, well-lit home corner — lived-in and believable | No studio backdrop; natural light or ring light |
| Camera Language | Handheld phone selfie perspective, slight natural sway; extreme close-up on demo moments | Write as "handheld phone selfie angle, slight natural camera movement" |
| Audio | Fast, conversational, genuinely reactive — NOT scripted commercial delivery | Every line as "人物对着镜头说：'...'" ; one line max per time segment |
| Post-Production | Face stability + product accuracy + lip-sync | Natural skin texture visible (no smoothing); product packaging text readable; lip-sync tight |

---

## Prompt Structure Template

Organize along a **second-by-second timeline** — six dimensions interwoven into the chronology:

```
[Person & product anchoring — natural appearance, no beauty-filter. All @ references declared upfront.] [Subject]

[0~Ns: Hook — pain-point / social-proof reply / skeptic opener + shot type] [Hook]
[N~Ms: demo action #1 (from Demo Action Framework) + casual reaction + shot type] [Action + Audio + Camera]
[M~Ls: demo action #2 + honest flaw or unscripted reaction embedded naturally] [Action + Audio + Camera]
[L~end: proof moment (timestamp / transfer test / wear condition) + closing line] [Proof + CTA]

[Scene — home/bedroom/bathroom, specific lived-in detail] [Scene & Tone]

手持手机自拍视角，轻微自然晃动；以怼脸近景为主，关键demo动作切换至极近特写。[Camera Language]

全程由人物本人口播发声，不使用旁白或背景配音。语气口语化、快节奏，保留真实反应语气词。人物嘴唇动作必须与台词完全同步。[Audio Constraints]

全程人物面部特征稳定不变形；保留自然肤质（不过度磨皮）；产品外观严格与 @Image 参考一致，瓶身文字清晰可读；嘴型与台词完全同步；画面无闪烁。[Post-Production Constraints]
```

**Critical rules**:
- Every dialogue line MUST be written as "人物对着镜头说：'...'" — never "台词：" or "Dialogue:" (the latter renders as voiceover, not lip-synced speech)
- Audio constraints MUST include "全程由人物本人口播发声，不使用旁白或背景配音"
- **Keep the entire prompt in the user's language** — do NOT translate to English for Scenario D; the model generates lip-synced speech from the dialogue text
- One dialogue line max per time segment

---

## Example 1: Multi-Product Unboxing

**Brief**: 14-second live-presenter unboxing video. One person showcases three products with spoken dialogue.

**Assets**: `@Image 1` (person), `@Image 2` (black bag + silver box), `@Image 3` (T-shirt)

**Prompt**:

> The person from @Image 1 wears a fixed outfit unchanged throughout. Products: black packaging bag, silver box @Image 2, T-shirt @Image 3 — visual details stay sharp throughout. **[Subject]**
>
> 0~1s: Person holds multiple products and places them on a metal table, looking at camera. Person speaks to camera: "Let's unbox these new items I just received." **[Action + Audio]**
>
> 1~8s: Person at table, right hand gesturing along with narration, body leaning slightly forward. Person speaks to camera: "The design and features of these products are really impressive…" **[Action + Audio]**
>
> 8~9s: Person stands by window, right hand raised toward camera. Person speaks to camera: "Now let's look at this T-shirt." **[Action + Audio]**
>
> 9~12s: Person touches T-shirt on chest with both hands, then extreme close-up of fingers pinching fabric to show texture. Person speaks to camera: "This T-shirt is made of lightweight fabric with great elasticity…" **[Action + Audio]**
>
> 12~14s: Person's hands drop naturally, expression relaxed. No speech, no background audio. **[Action + Audio]**
>
> All dialogue spoken on camera — no voiceover. Lip-sync consistent throughout. **[Audio Constraints]**
>
> Modern indoor: minimalist area (wooden wall panels, white bench) + beige marble-walled room. Natural light, clean and comfortable. **[Scene & Tone]**
>
> Fixed camera with medium shot, close-up, and extreme close-up switching. 9~12s pulls from medium to extreme close-up. **[Camera Language]**
>
> Facial features stable throughout; outfit unchanged; product appearance strictly matches @Image 2 and @Image 3; packaging text readable; lip movements sync with dialogue. **[Post-Production Constraints]**

---

## Example 2: UGC Foundation Long-Wear Review

**Brief**: 博主测评粉底液持妆12小时的带货短视频，10秒，UGC风格，素颜开场，要有真实感

**Assets**: `@Image 1` (natural selfie, visible skin texture), `@Image 2` (foundation bottle)

**Prompt** (stays in Chinese — Scenario D with dialogue):

> @Image 1 的女生主播，深棕色卷发、自然肤质（可见雀斑和轻微痘印），无美颜滤镜感，佩戴随意日常首饰，着简单居家上衣。产品为 @Image 2 的粉底液，金色细长瓶身，瓶身文字清晰可见，全程产品外观保持真实不失真。【主体】
>
> 0~3s：人物素颜出镜，手持粉底液瓶举到脸旁，直视镜头，表情带着一点怀疑。人物对着镜头说："它说能持妆一整天？我来试试。"手持手机自拍近景，轻微晃动，环形灯打亮面部。【Hook + 镜头】
>
> 3~6s：人物将粉底液泵少量在脸颊上，让其自然落下（产品已开盖，无需展示开盖动作）。① 一小泵落在脸颊，静置一秒。② 单指指腹轻点产品中心，未开始推开。③ 以小圆圈向外慢慢晕开，画面中仍能看到边缘未推匀的部分。半张脸已上妆、半张脸素颜形成自然对比。人物对着镜头说："哇，比我想的稀一点点…不过上脸感觉还挺贴的。"镜头缓缓推近至脸部极近特写。【Demo动作 + 真实反应】
>
> 6~10s：人物将腕部手表转向镜头，显示时间，随后再次面对镜头展示全脸妆效（窗边自然光下）。人物对着镜头说："过了12小时了，妆还在——就是有一点点氧化，但整体真的还不错诶。"镜头在手表特写和脸部自然光特写之间切换。【持妆验证 + 坦承缺点】
>
> 场景为现代家居，浅色墙面，桌面整洁但随意，窗边自然光为主光源。【场景】
>
> 手持手机自拍视角，轻微自然晃动；以怼脸近景为主，3~6s推近至极近特写展示半脸对比，6~10s切换手表特写与窗边脸部特写。【镜头语言】
>
> 全程由人物本人口播发声，不使用旁白或背景配音。语气口语化、快节奏，保留真实反应语气词（"哇""比我想的""诶"）。人物嘴唇动作必须与台词完全同步。【音频约束】
>
> 全程人物面部特征稳定不变形；保留自然肤质（不过度磨皮，保留雀斑和皮肤纹理）；产品外观严格与 @Image 2 一致，瓶身文字清晰可读；嘴型与台词完全同步；画面无闪烁无抖动。【后期约束】

**Why it works**: UGC Hook opens with skepticism. Physical Continuity Rule applied — product appears already open, no cap-removal teleport. Action Granularity Rule applied — foundation application broken into 3 sub-steps. Honest flaw ("有一点点氧化") embedded in dialogue. Watch face close-up as third-party timestamp proof. Natural skin constraints explicitly prevent beauty-filter smoothing.
