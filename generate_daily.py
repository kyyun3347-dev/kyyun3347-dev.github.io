"""
GitHub Actions / CI용 일일 단어 생성기 (docx 없이 JSON만 생성)
"""

import os
import sys
import json
import random
from datetime import date

IS_CI = os.environ.get('GITHUB_ACTIONS') == 'true'

def _load_words():
    import importlib, wordbank
    importlib.reload(wordbank)
    return wordbank.WORDS

WORDS = _load_words()

BASE_DIR      = os.path.dirname(os.path.abspath(__file__))
PROGRESS_FILE = os.path.join(BASE_DIR, "progress.json")
DATA_DIR      = os.path.join(BASE_DIR, "data")
WORDS_PER_DAY = 50
CYCLE_LENGTH  = 10


def load_progress():
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "total_session": 0,
        "total_study_days": 0,
        "total_review_days": 0,
        "used_indices": [],
        "cycle_indices": [],
        "history": []
    }


def save_progress(p):
    with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
        json.dump(p, f, ensure_ascii=False, indent=2)


def pick_new_words(used_indices):
    available = [i for i in range(len(WORDS)) if i not in set(used_indices)]
    if len(available) < WORDS_PER_DAY:
        return None, available
    selected = random.sample(available, WORDS_PER_DAY)
    return selected, available


def pick_review_words(cycle_indices):
    sample_size = min(WORDS_PER_DAY, len(cycle_indices))
    return random.sample(cycle_indices, sample_size)


def export_json(words_data, meta):
    os.makedirs(DATA_DIR, exist_ok=True)

    t       = meta.get("type", "study")
    day_num = meta.get("day", 0)
    rev_num = meta.get("review_num")

    payload = {
        "date":       meta.get("date", str(date.today())),
        "day":        day_num,
        "type":       t,
        "review_num": rev_num,
        "total":      len(words_data),
        "words": [
            {"en": w[0], "pos": w[1], "ko": w[2], "ex": w[3]}
            for w in words_data
        ]
    }

    with open(os.path.join(BASE_DIR, "today.json"), "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    key   = f"review{rev_num:02d}" if t == "review" else f"day{day_num:03d}"
    label = f"Review {rev_num:02d}" if t == "review" else f"Day {day_num:03d}"

    with open(os.path.join(DATA_DIR, f"{key}.json"), "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    archive_path = os.path.join(DATA_DIR, "archive.json")
    archive = []
    if os.path.exists(archive_path):
        with open(archive_path, "r", encoding="utf-8") as f:
            archive = json.load(f)
    archive = [a for a in archive if a["key"] != key]
    archive.insert(0, {"key": key, "label": label, "date": payload["date"], "type": t})
    with open(archive_path, "w", encoding="utf-8") as f:
        json.dump(archive, f, ensure_ascii=False, indent=2)

    print(f"  today.json + data/{key}.json exported ({len(words_data)} words)")
    return key, label


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "reset":
        if os.path.exists(PROGRESS_FILE):
            os.remove(PROGRESS_FILE)
        print("Progress reset.")
        return

    progress       = load_progress()
    used           = set(progress["used_indices"])
    cycle_indices  = progress["cycle_indices"]
    total_study    = progress["total_study_days"]
    total_review   = progress["total_review_days"]
    session_num    = progress["total_session"] + 1

    is_review = (total_study > 0) and (total_study % CYCLE_LENGTH == 0) and (
        total_review < total_study // CYCLE_LENGTH
    )

    if is_review:
        review_num     = total_review + 1
        cycle_num      = total_study // CYCLE_LENGTH
        review_indices = pick_review_words(cycle_indices)
        words_data     = [WORDS[i] for i in review_indices]
        random.shuffle(words_data)

        key, label = export_json(words_data, {
            "day": total_study, "type": "review",
            "review_num": review_num, "date": str(date.today())
        })

        progress["total_session"]    = session_num
        progress["total_review_days"] = total_review + 1
        progress["cycle_indices"]    = []
        progress["history"].append({
            "session": session_num, "date": str(date.today()),
            "type": "review", "review_num": review_num,
            "word_count": len(words_data)
        })
        save_progress(progress)
        print(f"[REVIEW] {label} generated!")

    else:
        new_indices, available = pick_new_words(list(used))
        if new_indices is None:
            print(f"[ERROR] Not enough words ({len(available)} left). Run refill first.")
            sys.exit(1)

        words_data = [WORDS[i] for i in new_indices]
        random.shuffle(words_data)

        study_day_num = total_study + 1
        key, label = export_json(words_data, {
            "day": study_day_num, "type": "study", "date": str(date.today())
        })

        progress["total_session"]    = session_num
        progress["total_study_days"] = study_day_num
        progress["used_indices"]     = progress["used_indices"] + new_indices
        progress["cycle_indices"]    = cycle_indices + new_indices
        progress["history"].append({
            "session": session_num, "date": str(date.today()),
            "type": "study", "study_day": study_day_num,
            "word_indices": new_indices
        })
        save_progress(progress)

        words_left = len(WORDS) - len(used) - WORDS_PER_DAY
        cycle_day  = study_day_num % CYCLE_LENGTH or CYCLE_LENGTH
        print(f"[STUDY] {label}  (Cycle day {cycle_day}/{CYCLE_LENGTH})")
        print(f"  Words remaining in bank: {words_left}")


if __name__ == "__main__":
    main()
