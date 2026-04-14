from notify import send
from datetime import date

TODAY = str(date.today())

if __name__ == "__main__":
    # 학습 안 한 사람
    send(
        title="공부 안 하면 장수영처럼 가슴커짐",
        message="오늘 단어 아직 안 외웠지? 지금 당장 해",
        filters=[
            {"field": "tag", "key": "learned_date", "relation": "!=", "value": TODAY},
        ]
    )
    # 학습은 했지만 시험 안 한 사람
    send(
        title="시험도 봐야돼요. 안 하면 이누림",
        message="단어는 외웠는데 시험은 안 봤잖아. 얼른",
        filters=[
            {"field": "tag", "key": "learned_date", "relation": "=",  "value": TODAY},
            {"operator": "AND"},
            {"field": "tag", "key": "quiz_date",    "relation": "!=", "value": TODAY},
        ]
    )
