import json
from notify import send_daily_notification

with open("progress.json") as f:
    p = json.load(f)
last = p["history"][-1]
if last["type"] == "review":
    label = "Review {:02d}".format(last["review_num"])
else:
    label = "Day {:03d}".format(last["study_day"])
send_daily_notification(label)
