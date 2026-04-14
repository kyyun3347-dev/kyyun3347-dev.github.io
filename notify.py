import urllib.request, urllib.error, json, os

APP_ID  = "747b3763-3c9b-4fc3-97ee-eaea25517c39"
API_KEY = os.environ.get("ONESIGNAL_API_KEY", "")


def send(title, message, filters=None, segments=None):
    payload = {
        "app_id": APP_ID,
        "target_channel": "push",
        "headings": {"en": title},
        "contents": {"en": message},
        "url": "https://kyyun3347-dev.github.io/",
    }
    if filters:
        payload["filters"] = filters
    else:
        payload["included_segments"] = segments or ["All"]

    data = json.dumps(payload).encode("utf-8")
    req  = urllib.request.Request(
        "https://onesignal.com/api/v1/notifications",
        data=data,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
            print(f"[NOTIFY] '{title}' sent, id: {result.get('id')}")
    except urllib.error.HTTPError as e:
        print(f"[NOTIFY] Failed: {e.code} {e.read().decode()}")
    except Exception as e:
        print(f"[NOTIFY] Error: {e}")


def send_daily_notification(day_label, word_count=50):
    send(
        title=f"오늘의 단어 ({day_label})",
        message=f"새 단어 {word_count}개가 준비됐어요! 지금 바로 외워보세요",
    )
