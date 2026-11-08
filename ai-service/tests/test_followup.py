from __future__ import annotations

import pytest

from app.harness.followup import is_follow_up, strip_language_request, topic, turn_output_language


@pytest.mark.parametrize(
    "text",
    [
        "tell me in more detail than this",
        "tell me more",
        "more?",
        "is that it",
        "check the web",
        "search it online",
        "you not telling me",
        "you're not answering what i asked",
        "answer in khmer",
        "explain more",
        "again",
        "ពន្យល់បន្ថែម",
    ],
)
def test_follow_ups(rules, text):
    assert is_follow_up(text, rules)


@pytest.mark.parametrize(
    "text",
    [
        "what is the weather like in Cambodia",
        "tell me about photosynthesis",
        "what did he do in 2024",
        "explain the water cycle",
    ],
)
def test_real_questions(rules, text):
    assert not is_follow_up(text, rules)


def test_topic_skips_follow_ups(rules):
    history = [
        {"role": "user", "content": "what is the weather like in Cambodia right now"},
        {"role": "assistant", "content": "It's sunny."},
        {"role": "user", "content": "check the web"},
        {"role": "assistant", "content": "33 °C."},
    ]
    assert topic(history, "check the web", rules) == "what is the weather like in Cambodia right now"
    assert topic([], None, rules) is None


def test_turn_output_language(rules):
    assert turn_output_language("what is an animal, answer in khmer", "EN", "EN", rules) == "KM"
    assert turn_output_language("តើទឹកភ្លៀងកើតឡើងដោយរបៀបណា?", "KM", "EN", rules) == "KM"
    assert turn_output_language("explain in english please", "EN", "KM", rules) == "EN"
    assert turn_output_language("explain more", "EN", "EN", rules, "តើទឹកភ្លៀងកើតឡើងដោយរបៀបណា?") == "KM"
    assert turn_output_language("what is an animal", "EN", "EN", rules) == "EN"


def test_strip_language_request(rules):
    assert strip_language_request("what is an animal, answer in khmer", rules) == "what is an animal"
    assert (
        strip_language_request("tell me what is Korean language in khmer", rules) == "tell me what is Korean language"
    )
