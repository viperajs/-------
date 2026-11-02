"""Episode configs: script, caption colours, shot list and on-screen text.

Each episode renders with:  ./build.sh <episode>   (e.g. ./build.sh ep2)
"""

NARRATOR = "en-US-AnaNeural"          # child narrator
THING = "en-US-JennyNeural"           # the creature's voice


def ep1(L, w):
    """Dinner's Ready: the voice from the kitchen."""
    scare = round(L["n6"]["end"] + 0.75, 3)
    endcard = round(scare + 0.95, 3)
    shots = [
        ("bedroom", 0.0),
        ("door", w("n1", "down")["s"]),
        ("doorgap", L["m1"]["words"][0]["s"] - 0.15),
        ("stairs", L["n3"]["words"][0]["s"] - 0.1),
        ("phone", L["n5"]["words"][0]["s"] - 0.25),
        ("kitchen", L["n6"]["words"][0]["s"] - 0.1),
        ("turn", w("n6", "in")["s"]),
        ("scare", scare),
        ("endcard", endcard),
    ]
    marks = {
        "seven": w("n1", "called")["s"],
        "buzz": w("n3", "buzzed")["s"],
        "notify": L["n5"]["words"][0]["s"] - 0.1,
        "circle": w("n5", "stuck")["s"],
        "tension": L["n6"]["words"][0]["s"] - 0.1,
        "scare": scare, "endcard": endcard, "total": round(endcard + 2.45, 3),
    }
    return shots, marks


def ep2(L, w):
    """The Babysitter: it was standing by the bed the whole time."""
    scare = round(L["m1"]["end"] + 0.4, 3)
    endcard = round(scare + 0.95, 3)
    shots = [
        ("nursery", 0.0),
        ("bedphone", L["n2"]["words"][0]["s"] - 0.15),
        ("phone", L["n3"]["words"][0]["s"] - 0.3),
        ("lookup", L["n4"]["words"][0]["s"] - 0.1),
        ("reveal", w("n4", "me")["s"] + 0.05),
        ("scare2", scare),
        ("endcard2", endcard),
    ]
    marks = {
        "lampoff": L["n1"]["end"] + 0.05,
        "buzz": L["n2"]["words"][0]["s"] + 0.05,
        "notify": L["n3"]["words"][0]["s"] - 0.15,
        "circle": w("n3", "cancelled")["s"],
        "tension": L["n4"]["words"][0]["s"] - 0.1,
        "scare": scare, "endcard": endcard, "total": round(endcard + 2.3, 3),
    }
    return shots, marks


EPISODES = {
    "ep1": {
        "out": "dinners-ready.mp4",
        "lines": [
            ("n1", NARRATOR, "+5%", "+0Hz", "Mom called me down for dinner.", None),
            ("m1", THING, "-15%", "-18Hz", "Sweetie... dinner's ready!", "distant"),
            ("n3", NARRATOR, "+5%", "+0Hz", "Then my phone buzzed.", None),
            ("n5", NARRATOR, "+0%", "-4Hz", "Mom: stuck at work till midnight.", None),
            ("n6", NARRATOR, "-5%", "-6Hz", "So who's in the kitchen?", None),
        ],
        "gaps": {"n1": 0.25, "m1": 0.25, "n3": 0.30, "n5": 0.20, "n6": 0.35},
        "red": {"seven", "kitchen", "dinner's", "ready", "buzzed", "mom", "midnight",
                "door", "cooking", "sweetie"},
        "shots": ep1,
        "text": {
            "title": ["MOM CALLED ME DOWN", "FOR DINNER... \U0001F628"],
            "endtop": ["\"SWEETIE, DINNER'S", "READY!\""],
            "endbot": ["MOM WAS STILL", "AT WORK \U0001F631", "SO WHO'S IN THE KITCHEN? \U0001F480"],
            "phone": {"date": "Friday, October 31", "time": "7:00", "from": "Mom ❤️",
                      "l1": "Stuck at work till midnight.", "l2": "Lock your door. \U0001F629"},
        },
    },
    "ep2": {
        "out": "babysitter.mp4",
        "lines": [
            ("n1", NARRATOR, "+5%", "+0Hz", "My babysitter tucked me in tonight.", None),
            ("n2", NARRATOR, "+5%", "+0Hz", "Then Mom texted me.", None),
            ("n3", NARRATOR, "+8%", "-4Hz", "Babysitter cancelled. You're home alone.", None),
            ("n4", NARRATOR, "-8%", "-6Hz", "So who tucked me in?", None),
            ("m1", THING, "-18%", "-26Hz", "Sleep tight, sweetie.", "whisper"),
        ],
        "gaps": {"n1": 0.2, "n2": 0.35, "n3": 0.2, "n4": 0.3, "m1": 0.25},
        "red": {"babysitter", "mom", "cancelled", "alone", "who", "tucked", "sleep", "tight", "sweetie"},
        "shots": ep2,
        "text": {
            "title": ["MY BABYSITTER TUCKED", "ME IN TONIGHT... \U0001F628"],
            "endtop": ["\"SLEEP TIGHT,", "SWEETIE\""],
            "endbot": ["MY BABYSITTER", "CANCELLED \U0001F631", "SO WHO TUCKED ME IN? \U0001F480"],
            "phone": {"date": "Sunday, November 1", "time": "9:47", "from": "Mom ❤️",
                      "l1": "Babysitter cancelled \U0001F629", "l2": "You're home alone tonight."},
        },
    },
}
