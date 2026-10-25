from flask import (
    Flask, render_template, request, jsonify, redirect, session, url_for
)
from PIL import Image
from werkzeug.exceptions import RequestEntityTooLarge
from datetime import datetime
import pytesseract
import os

app = Flask(__name__)
app.secret_key = "vision-assist-demo-key-change-later"

GUEST_ACCOUNTS = [
    "Guest One",
    "Guest Two",
    "Guest Three"
]
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024

@app.route("/")
def home():
    if "guest" not in session:
        return redirect(url_for("login"))

    return render_template(
        "index.html",
        guest_name=session["guest"]
    )


@app.route("/login")
def login():
    if "guest" in session:
        return redirect(url_for("home"))

    return render_template("login.html")


@app.route("/guest-login", methods=["POST"])
def guest_login():
    guest = request.form.get("guest", "")

    if guest not in GUEST_ACCOUNTS:
        return redirect(url_for("login"))

    session["guest"] = guest
    return redirect(url_for("home"))


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/api/command", methods=["POST"])
def process_command():
    data = request.get_json(silent=True) or {}
    command = str(data.get("command", "")).lower().strip()

    if not command:
        return jsonify({"reply": "Please say a command."})

    if "hello" in command:
        reply = "Hello! Welcome to Vision Assist."

    elif "help" in command:
        reply = (
            "You can ask for the time, read text from an image, "
            "find your location, or use emergency contacts."
        )

    elif "time" in command:
        current_time = datetime.now().strftime("%I:%M %p")
        reply = "The current time is " + current_time

    elif "read text" in command or "read image" in command:
        reply = (
            "Please use the Read Text from Image section "
            "to upload a photograph."
        )

    elif "location" in command or "navigate" in command:
        reply = (
            "Please use the Location Assistance button "
            "and allow location access."
        )

    elif "emergency" in command:
        reply = (
            "Please use the emergency contact section "
            "to call your trusted person or emergency services."
        )

    else:
        reply = (
            "Sorry, I did not understand. "
            "Please say help to hear the available commands."
        )

    return jsonify({"reply": reply})


@app.route("/api/ocr", methods=["POST"])
def read_image():
    uploaded_file = request.files.get("image")

    if not uploaded_file or uploaded_file.filename == "":
        return jsonify({"error": "Please select an image."}), 400

    try:
        image = Image.open(uploaded_file.stream)
        image.verify()

        uploaded_file.stream.seek(0)
        image = Image.open(uploaded_file.stream).convert("RGB")

        if image.width * image.height > 20_000_000:
            return jsonify({
                "error": "This image is too large. Please use a smaller image."
            }), 400

        extracted_text = pytesseract.image_to_string(
            image,
            lang="eng"
        ).strip()

        if not extracted_text:
            extracted_text = (
                "No text was detected. Try a clearer, well-lit image."
            )

        return jsonify({"text": extracted_text})

    except Exception:
        return jsonify({
            "error": (
                "Could not read this image. Check that Tesseract is "
                "installed and try a clear JPG or PNG photograph."
            )
        }), 400


@app.errorhandler(RequestEntityTooLarge)
def file_too_large(error):
    return jsonify({"error": "Image must be smaller than 5 MB."}), 413


if __name__ == "__main__":
    app.run(debug=True)
