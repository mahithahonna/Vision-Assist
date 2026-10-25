const $ = (id) => document.getElementById(id);

function speak(text) {
    if (!("speechSynthesis" in window)) {
        $("status").textContent = text;
        return;
    }

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = "en-IN";
    window.speechSynthesis.speak(speech);
}

async function sendCommand(command) {
    try {
        const response = await fetch("/api/command", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ command: command })
        });

        const data = await response.json();

        $("responseText").textContent = data.reply;
        speak(data.reply);
    } catch (error) {
        speak("Sorry, the server could not be reached.");
    }
}

$("helpButton").addEventListener("click", () => {
    speak(
        "Welcome to Vision Assist. You can use voice commands, " +
        "read text from an image, and manage emergency contacts."
    );
});

$("micButton").addEventListener("click", () => {
    const Recognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!Recognition) {
        speak("Voice recognition is not supported in this browser.");
        return;
    }

    const recognition = new Recognition();
    recognition.lang = "en-IN";
    recognition.continuous = false;

    $("status").textContent = "Listening. Please speak now.";
    $("micButton").disabled = true;
    speak("Please speak now.");

    recognition.onresult = (event) => {
        const command = event.results[0][0].transcript;
        $("recognizedText").textContent = "You said: " + command;
        sendCommand(command);
    };

    recognition.onerror = () => {
        speak("I could not recognize your voice. Please try again.");
    };

    recognition.onend = () => {
        $("micButton").disabled = false;
    };

    try {
        recognition.start();
    } catch (error) {
        $("micButton").disabled = false;
        speak("Could not start the microphone. Please try again.");
    }
});

let extractedText = "";

$("readButton").addEventListener("click", async () => {
    const file = $("imageInput").files[0];

    if (!file) {
        speak("Please choose an image first.");
        return;
    }

    if (!["image/jpeg", "image/png"].includes(file.type)) {
        speak("Please choose a JPG or PNG image.");
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        speak("The image must be smaller than 5 megabytes.");
        return;
    }

    const formData = new FormData();
    formData.append("image", file);

    $("ocrResult").textContent = "Reading image. Please wait.";
    $("readButton").disabled = true;

    try {
        const response = await fetch("/api/ocr", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Could not read the image.");
        }

        extractedText = data.text;
        $("ocrResult").textContent = extractedText;
        $("speakOcrButton").hidden = !extractedText;
        speak(extractedText);
    } catch (error) {
        $("ocrResult").textContent = error.message;
        speak(error.message);
    } finally {
        $("readButton").disabled = false;
    }
});

$("speakOcrButton").addEventListener("click", () => {
    if (extractedText) speak(extractedText);
});

function loadContacts() {
    let contacts = [];

    try {
        contacts = JSON.parse(
            localStorage.getItem("visionContacts") || "[]"
        );
    } catch (error) {
        contacts = [];
    }

    if (!Array.isArray(contacts)) contacts = [];

    $("contactList").replaceChildren();

    contacts.forEach((contact, index) => {
        const item = document.createElement("div");
        const name = document.createElement("p");
        const phone = document.createElement("p");
        const call = document.createElement("a");
        const remove = document.createElement("button");

        name.textContent = contact.name;
        phone.textContent = contact.phone;

        call.textContent = "Call " + contact.name;
        call.href = "tel:" + contact.phone;
        call.className = "emergencyLink";

        remove.textContent = "Delete " + contact.name;
        remove.className = "secondary";
        remove.addEventListener("click", () => {
            contacts.splice(index, 1);
            localStorage.setItem(
                "visionContacts",
                JSON.stringify(contacts)
            );
            loadContacts();
            speak("Contact deleted.");
        });

        item.append(name, phone, call, remove);
        $("contactList").appendChild(item);
    });
}

$("saveContactButton").addEventListener("click", () => {
    const name = $("contactName").value.trim();
    const phone = $("contactPhone").value.trim();

    // Allow digits, spaces, plus, parentheses and hyphens
    if (!name || !/^\+?[0-9 ()-]{7,20}$/.test(phone)) {
        speak("Enter a contact name and a valid phone number.");
        return;
    }

    try {
        const contacts = JSON.parse(
            localStorage.getItem("visionContacts") || "[]"
        );

        if (!Array.isArray(contacts) || contacts.length >= 10) {
            speak("You can save up to ten contacts.");
            return;
        }

        contacts.push({ name: name, phone: phone });

        localStorage.setItem(
            "visionContacts",
            JSON.stringify(contacts)
        );

        $("contactName").value = "";
        $("contactPhone").value = "";
        $("contactStatus").textContent = "Contact saved on this device.";
        loadContacts();
        speak("Contact saved successfully.");
    } catch (error) {
        speak("Could not save the contact in this browser.");
    }
});

loadContacts();
