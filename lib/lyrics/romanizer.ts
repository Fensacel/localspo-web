/**
 * Comprehensive, zero-dependency Korean Hangul & Japanese (Kanji + Kana) Romanizer for LocalSpo Web.
 * Fully deterministic & browser-compatible.
 */

// ==========================================
// KOREAN HANGUL ROMANIZATION (Revised Romanization)
// ==========================================
const HANGUL_START = 0xac00
const HANGUL_END = 0xd7a3

const CHOSEONG = [
  'g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'
]

const VOWELS = [
  'a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'
]

const FINALS = [
  '', 'g', 'gg', 'gs', 'n', 'nj', 'nh', 'd', 'l', 'lg', 'lm', 'lb', 'ls', 'lt', 'lp', 'lh', 'm', 'b', 'bs', 's', 'ss', 'ng', 'j', 'ch', 'k', 't', 'p', 'h'
]

function romanizeHangulChar(char: string): string {
  const code = char.charCodeAt(0)
  if (code < HANGUL_START || code > HANGUL_END) return char

  const index = code - HANGUL_START
  const initialIdx = Math.floor(index / 588)
  const vowelIdx = Math.floor((index % 588) / 28)
  const finalIdx = index % 28

  const initial = CHOSEONG[initialIdx] ?? ''
  const vowel = VOWELS[vowelIdx] ?? ''
  const final = FINALS[finalIdx] ?? ''

  return initial + vowel + final
}

export function romanizeKorean(text: string): string {
  let result = ''
  let inHangulWord = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const code = char.charCodeAt(0)
    const isHangul = code >= HANGUL_START && code <= HANGUL_END

    if (isHangul) {
      let rom = romanizeHangulChar(char)
      if (!inHangulWord && rom.length > 0) {
        rom = rom.charAt(0).toUpperCase() + rom.slice(1)
        inHangulWord = true
      }
      result += rom
    } else {
      if (/\s/.test(char) || /[^\w']/.test(char)) {
        inHangulWord = false
      }
      result += char
    }
  }

  return result
}

// ==========================================
// JAPANESE (KANJI + KANA) ROMANIZATION
// ==========================================

// Common Japanese Kanji Compounds in Songs/Lyrics (Radwimps, Vocaloid, Anime, J-Pop)
const KANJI_COMPOUNDS: Record<string, string> = {
  予測できない: 'yosoku dekinai',
  予測: 'yosoku',
  飼いならしていたい: 'kainarashiteitai',
  飼いならし: 'kainarashi',
  飼い: 'kai',
  望み通り: 'nozomi toori',
  望み: 'nozomi',
  通り: 'toori',
  美しく: 'utsukushiku',
  美しい: 'utsukushii',
  美し: 'utsukushi',
  互い: 'tagai',
  砂時計: 'sunadokei',
  眺めながら: 'nagamenagara',
  眺め: 'nagame',
  一番違い: 'ichiban chigai',
  一番: 'ichiban',
  間違い: 'machigai',
  間違: 'chiga',
  本当: 'hontou',
  世界: 'sekai',
  未来: 'mirai',
  過去: 'kako',
  現在: 'genzai',
  期待: 'kitai',
  秘密: 'himitsu',
  友達: 'tomodachi',
  自由: 'jiyuu',
  笑顔: 'egao',
  涙: 'namida',
  約束: 'yakusoku',
  奇跡: 'kiseki',
  運命: 'unmei',
  永遠: 'eien',
  記憶: 'kioku',
  感情: 'kanjou',
  瞬間: 'shunkan',
  理由: 'riyuu',
  意味: 'imi',
  場所: 'basho',
  時間: 'jikan',
  最後: 'saigo',
  最初: 'saisho',
  言葉: 'kotoba',
  自分: 'jibun',
  一人: 'hitori',
  二人: 'futari',
  一緒: 'issho',
  今夜: 'konya',
  今日: 'kyou',
  明日: 'ashita',
  昨日: 'kinou',
  誰か: 'dareka',
  何か: 'nanika',
  どこか: 'dokoka',
  いつも: 'itsumo',
  大空: 'oozora',
  青空: 'aozora',
  夜空: 'yozora',
  星空: 'hoshizora',
  太陽: 'taiyou',
  季節: 'kisetsu',
  孤独: 'kodoku',
  情熱: 'jounetsu',
  憧れ: 'akogare',
  希望: 'kibou',
  絶望: 'zetsubou',
  現実: 'genjitsu',
  幻想: 'gensou',
  真実: 'shinjitsu',
  奇跡的: 'kisekiteki',
  一生: 'isshou',
  愛してる: 'aishiteru',
  大好き: 'daisuki',
  大丈夫: 'daijoubu',
  暗い夜: 'kurai yoru',
  暗い: 'kurai',
  重力: 'juuryoku',
  運命の: 'unmei no',
}

// Extensive Single Kanji Reading Map
const KANJI_MAP: Record<string, string> = {
  // Reading & Action
  予: 'yo', 測: 'soku', 暗: 'kura', 飛: 'to', 回: 'mawa', 違: 'chiga', 合: 'a', 近: 'chika', 気: 'ki',
  見: 'mi', 聞: 'ki', 言: 'i', 行: 'i', 来: 'ki', 手: 'te', 目: 'me',
  心: 'kokoro', 愛: 'ai', 夢: 'yume', 今: 'ima', 君: 'kimi', 僕: 'boku',
  私: 'watashi', 音: 'oto', 歌: 'uta', 声: 'koe', 夜: 'yoru', 朝: 'asa',
  日: 'hi', 月: 'tsuki', 星: 'hoshi', 空: 'sora', 風: 'kaze', 雨: 'ame',
  花: 'hana', 道: 'michi', 光: 'hikari', 影: 'kage', 命: 'inochi', 生: 'iki',
  死: 'shi', 時: 'toki', 何: 'nani', 走: 'hashi', 歩: 'aru',
  泳: 'oyog', 抱: 'daki', 守: 'mamor', 信: 'shin', 願: 'nega', 探: 'saga',
  忘: 'wasure', 覚: 'obe', 笑: 'wara', 泣: 'na', 叫: 'sake', 踊: 'odo',
  魅: 'mi', 壊: 'kowa', 離: 'hana', 繋: 'tsuna', 届: 'tode', 知: 'shi',
  話: 'hana', 答: 'kota', 始: 'haji', 終: 'owa', 止: 'toma', 変: 'kawa',
  咲: 'sa', 散: 'chi', 墜: 'och', 鳴: 'na', 想: 'omoi', 触: 'fure',
  揺: 'yure', 迷: 'mayo', 祈: 'ino', 奪: 'uba', 逃: 'nige', 崩: 'kuzu',
  響: 'hibiki', 浮: 'uka', 沈: 'shizuma', 隠: 'kaku', 誓: 'chika', 望: 'nozo',
  許: 'yuru', 残: 'noko', 狂: 'kuru', 惹: 'hika', 溢: 'afure', 輝: 'kagaya',
  煌: 'kirame', 燃: 'moe', 照: 'tera', 消: 'kie', 恐: 'osore', 描: 'ega',
  飾: 'kaza', 導: 'michi', 満: 'michi', 深: 'fuka', 浅: 'asa', 遠: 'too',
  高: 'taka', 低: 'hiki', 強: 'tsuyo', 弱: 'yowa', 優: 'yasa', 激: 'hisa',
  悲: 'kanasha', 嬉: 'ure', 切: 'setsu', 苦: 'kuru', 痛: 'ita', 寂: 'sabi',
  恋: 'koi', 楽: 'tano', 新: 'atara', 古: 'furu', 赤: 'aka', 青: 'ao',
  白: 'shiro', 黒: 'kuro', 黄: 'kii', 緑: 'midori', 紫: 'murasaki', 大: 'oo',
  小: 'chii', 長: 'naga', 短: 'miga', 多: 'oo', 少: 'suku', 早: 'haya',
  遅: 'osoi', 重: 'omoi', 軽: 'karu', 熱: 'atsu', 冷: 'tsume', 温: 'atata',
  寒: 'samu', 暖: 'atata', 海: 'umi', 川: 'kawa', 山: 'yama', 森: 'mori',
  林: 'hayashi', 木: 'ki', 草: 'kusa', 葉: 'ha', 根: 'ne', 石: 'ishi',
  砂: 'suna', 土: 'tsuchi', 火: 'hi', 水: 'mizu', 氷: 'koori', 雪: 'yuki',
  雲: 'kumo', 雷: 'kaminari', 虹: 'niji', 波: 'nami', 渚: 'nagisa', 潮: 'shio',
  港: 'minato', 船: 'fune', 街: 'machi', 村: 'mura', 家: 'ie', 部屋: 'heya',
  窓: 'mado', 扉: 'tobira', 鍵: 'kagi', 鏡: 'kagami', 時計: 'tokei', 人: 'hito',
  女: 'onna', 男: 'otoko', 子: 'ko', 親: 'oya', 母: 'haha', 父: 'chichi',
  兄: 'ani', 弟: 'otouto', 姉: 'ane', 妹: 'imouto', 敵: 'teki', 味方: 'mikata', 誰: 'dare',

  // Additional Kanji from Sparkle / Your Name / Pop Lyrics
  飼: 'ka', 通: 'too', 美: 'utsuku', 互: 'taga', 計: 'kei', 眺: 'naga', 番: 'ban',
  選: 'era', 勝: 'ka', 負: 'make', 現: 'gen', 実: 'jitsu', 神: 'kami',
  仏: 'hotoke', 鬼: 'oni', 龍: 'ryuu', 虎: 'tora', 狼: 'ookami', 鳥: 'tori',
  羽: 'hane', 翼: 'tsubasa', 景: 'kei', 色: 'iro', 形: 'katachi', 姿: 'sugata',
  痕: 'ato', 跡: 'ato', 傷: 'kizu', 毒: 'doku',
  薬: 'kusuri', 罪: 'tsumi', 罰: 'batsu', 罠: 'wana', 鎖: 'kusari',
  壁: 'kabe', 天: 'ten', 地: 'chi', 宙: 'chuu', 界: 'kai',
  國: 'kuni', 国: 'kuni', 王: 'ou', 姫: 'hime', 騎士: 'kishi', 剣: 'ken',
  銃: 'juu', 弾: 'tama', 拳: 'kobushi', 盾: 'tate', 炎: 'honoo',
}

const KANA_MAP: Record<string, string> = {
  // Hiragana
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', を: 'wo', ん: 'n',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  きゃ: 'kya', きゅ: 'kyu', きょ: 'kyo',
  しゃ: 'sha', しゅ: 'shu', しょ: 'sho',
  ちゃ: 'cha', ちゅ: 'chu', ちょ: 'cho',
  にゃ: 'nya', にゅ: 'nyu', にょ: 'nyo',
  ひゃ: 'hya', ひゅ: 'hyu', ひょ: 'hyo',
  みゃ: 'mya', みゅ: 'myu', みょ: 'myo',
  りゃ: 'rya', りゅ: 'ryu', りょ: 'ryo',
  ぎゃ: 'gya', ぎゅ: 'gyu', ぎょ: 'gyo',
  じゃ: 'ja', じゅ: 'ju', じょ: 'jo',
  びゃ: 'bya', びゅ: 'byu', びょ: 'byo',
  ぴゃ: 'pya', ぴゅ: 'pyu', ぴょ: 'pyo',

  // Katakana
  ア: 'a', イ: 'i', ウ: 'u', エ: 'e', オ: 'o',
  カ: 'ka', キ: 'ki', ク: 'ku', ケ: 'ke', コ: 'ko',
  サ: 'sa', シ: 'shi', ス: 'su', セ: 'se', ソ: 'so',
  タ: 'ta', チ: 'chi', ツ: 'tsu', テ: 'te', ト: 'to',
  ナ: 'na', ニ: 'ni', ヌ: 'nu', ネ: 'ne', ノ: 'no',
  ハ: 'ha', ヒ: 'hi', フ: 'fu', ヘ: 'he', ホ: 'ho',
  マ: 'ma', ミ: 'mi', ム: 'mu', メ: 'me', モ: 'mo',
  ヤ: 'ya', ユ: 'yu', ヨ: 'yo',
  ラ: 'ra', リ: 'ri', ル: 'ru', レ: 're', ロ: 'ro',
  ワ: 'wa', ヲ: 'wo', ン: 'n', ー: '',
  ガ: 'ga', ギ: 'gi', グ: 'gu', ゲ: 'ge', ゴ: 'go',
  ザ: 'za', ジ: 'ji', ズ: 'zu', ゼ: 'ze', ゾ: 'zo',
  ダ: 'da', ヂ: 'ji', ヅ: 'zu', デ: 'de', ド: 'do',
  バ: 'ba', ビ: 'bi', ブ: 'bu', ベ: 'be', ボ: 'bo',
  パ: 'pa', ピ: 'pi', プ: 'pu', ペ: 'pe', ポ: 'po',
  キャ: 'kya', キュ: 'kyu', キョ: 'kyo',
  シャ: 'sha', シュ: 'shu', ショ: 'sho',
  チャ: 'cha', チュ: 'chu', チョ: 'cho',
  ニャ: 'nya', ニュ: 'nyu', ニョ: 'nyo',
  ヒャ: 'hya', ヒュ: 'hyu', ヒョ: 'hyo',
  ミャ: 'mya', ミュ: 'myu', ミョ: 'myo',
  リャ: 'rya', リュ: 'ryu', リョ: 'ryo',
  ギャ: 'gya', ギュ: 'gyo', ギョ: 'gyo',
  ジャ: 'ja', ジュ: 'ju',
  ビャ: 'bya', ビュ: 'byu', ビョ: 'byo',
  ピャ: 'pya', ピュ: 'pyu', ピョ: 'pyo',
}

export function romanizeJapanese(text: string): string {
  let res = ''
  let i = 0
  let isStartOfWord = true

  while (i < text.length) {
    // 1. Multi-character Kanji compounds lookup (e.g. 予測, 望み通り, 互いの砂時計, 眺めながら, 飼いならしていたい)
    let compoundMatched = false
    for (let len = 10; len >= 2; len--) {
      if (i + len <= text.length) {
        const sub = text.slice(i, i + len)
        if (KANJI_COMPOUNDS[sub]) {
          let rom = KANJI_COMPOUNDS[sub]
          if (isStartOfWord) {
            rom = rom.charAt(0).toUpperCase() + rom.slice(1)
            isStartOfWord = false
          }
          res += rom
          i += len
          compoundMatched = true
          break
        }
      }
    }
    if (compoundMatched) continue

    // 2. Single Kanji lookup (e.g. 飼 -> ka, 通 -> too, 美 -> utsuku, 互 -> taga, 計 -> kei, 眺 -> naga)
    const currentChar = text[i]
    if (KANJI_MAP[currentChar]) {
      let rom = KANJI_MAP[currentChar]
      if (isStartOfWord) {
        rom = rom.charAt(0).toUpperCase() + rom.slice(1)
        isStartOfWord = false
      }
      res += rom
      i++
      continue
    }

    // 3. Sokuon っ / ッ (doubles next consonant)
    if ((currentChar === 'っ' || currentChar === 'ッ') && i + 1 < text.length) {
      const nextPair = text.slice(i + 1, i + 3)
      const nextSingle = text.slice(i + 1, i + 2)
      const rom = KANA_MAP[nextPair] || KANA_MAP[nextSingle] || KANJI_MAP[nextSingle]
      if (rom) {
        let doubleCons = rom[0]
        if (isStartOfWord) {
          doubleCons = doubleCons.toUpperCase()
          isStartOfWord = false
        }
        res += doubleCons
        i++
        continue
      }
    }

    // 4. Digraph Kana lookup (e.g. きゃ, シュ)
    if (i + 1 < text.length) {
      const pair = text.slice(i, i + 2)
      if (KANA_MAP[pair]) {
        let rom = KANA_MAP[pair]
        if (isStartOfWord) {
          rom = rom.charAt(0).toUpperCase() + rom.slice(1)
          isStartOfWord = false
        }
        res += rom
        i += 2
        continue
      }
    }

    // 5. Single Kana lookup
    if (KANA_MAP[currentChar]) {
      let rom = KANA_MAP[currentChar]
      if (isStartOfWord) {
        rom = rom.charAt(0).toUpperCase() + rom.slice(1)
        isStartOfWord = false
      }
      res += rom
    } else {
      // Spaces, English letters, Punctuation
      if (/\s/.test(currentChar) || /[^\w']/.test(currentChar)) {
        isStartOfWord = true
      }
      res += currentChar
    }
    i++
  }

  return res
}

// --- Script Detection ---
export function hasKorean(text: string): boolean {
  return /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/.test(text)
}

export function hasJapanese(text: string): boolean {
  return /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(text)
}

/**
 * Main Romanization function. Preserves exact text structure and timing.
 * Leaves non-Asian characters, punctuation, numbers, and unconvertible text intact.
 */
export function romanizeText(text: string): string {
  if (!text || typeof text !== 'string') return ''

  let out = text

  if (hasKorean(out)) {
    out = romanizeKorean(out)
  }

  if (hasJapanese(out)) {
    out = romanizeJapanese(out)
  }

  return out
}
