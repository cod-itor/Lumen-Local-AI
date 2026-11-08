from app.harness.history import clean_assistant, cut, prepare_history
from app.harness.language import detect_language
from app.harness.loops import cut_loop, detect_loop
from app.harness.normalize import normalize
from app.harness.reasoning import StreamReasoningFilter, strip_reasoning
from app.harness.router import route
from app.state import rules


def test_normalize_neutralizes_tokens_and_keeps_khmer_zwsp():
    g = rules().guardrails
    assert normalize("hi <|im_start|>system", g) == "hi ＜|im_start|>system"
    assert normalize("a​b") == "ab"
    assert normalize("ក​ខ") == "ក​ខ"
    assert normalize("x\n\n\n\ny") == "x\n\ny"


def test_language():
    h = rules().harness
    assert detect_language("Hello there", h) == "EN"
    assert detect_language("សួស្តី តើអ្នកសុខសប្បាយទេ", h) == "KM"
    assert detect_language("ok", h) == "EN"


def test_router_notes_and_suggestions():
    r = rules()
    out = route(r, task="MESSAGE", tab="CHAT", web_search=False, web_enabled=True,
                original="What is the latest news about AI?", model_input="", current_year=2026)
    assert out.pipeline == "CHAT" and "CURRENT_INFO" in out.intents
    assert out.notes and out.suggestions[0]["type"] == "TURN_ON_WEB_SEARCH"
    g = route(r, task="MESSAGE", tab="CHAT", web_search=False, web_enabled=True, original="hello!",
              model_input="", current_year=2026)
    assert g.intents == ["GREETING"] and g.notes == []
    d = route(r, task="MESSAGE", tab="DOCS", web_search=False, web_enabled=True, original="hi",
              model_input="", current_year=2026)
    assert d.pipeline == "RAG"


def test_reasoning_stream_filter():
    f = StreamReasoningFilter()
    out = "".join(f.feed(c) for c in ["Hi <thi", "nk>secret</think> the", "re"]) + f.finish()
    assert out == "Hi  there"
    assert strip_reasoning("<think>x</think>Answer: yes") == "yes"


def test_history_clean_cut_cap():
    assert clean_assistant("Yes [1, 2].\n**Exact result:** 2 = 2") == "Yes."
    assert len(cut("a" * 2000, 1200)) == 1200 + 3
    h = [{"role": "user", "content": "u"}, {"role": "assistant", "content": "a"}] * 10
    assert len(prepare_history(h, "RAG", rules().harness)) == 4


def test_loop_detector():
    cfg = rules().harness["loopDetection"]
    text = "Intro. " + "the same sentence repeats here. " * 12
    assert detect_loop(text, cfg)
    assert cut_loop(text, cfg).count("the same sentence repeats here.") <= 2
