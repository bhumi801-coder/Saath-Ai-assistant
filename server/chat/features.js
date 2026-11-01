// What the Saath website can do, written once as (1) a guide for the AI and (2) short built-in answers
// in English / Hindi / Hinglish. Keep both in sync when you add a feature to the site.

export const SITE_GUIDE = `
SAATH, FEATURE GUIDE
Saath is a website where neighbours in a housing society (Uttar Pradesh) book home and car services together. Services: AC repair and service, car wash, deep home cleaning, water purifier service, pest control, sofa and carpet cleaning.

Residents
- Sign up (/signup) with name, email, password, a 10-digit mobile, society and flat number. If the society is not listed, add it on the sign-up page (search box, then "My society is not in the list"). Log in at /login. Forgot password at /forgot-password: a 6-digit code is sent by email and by SMS/WhatsApp, valid 15 minutes, one use, 5 wrong tries, 3 codes per hour.
- Services (/services) and each service page (/services/<slug>) show what is included and the open groups.
- Groups (/groups) lists groups in a society. A group = one service, one society, one date, one arrival time slot (6-9, 9-12, 12-3, 3-6, 6-8), a target number of flats and a group price. When the target is reached the group price unlocks for everyone. Joining is free and nothing is charged if the target is not reached.
- Start a group at /new (needs login): choose service, date (tomorrow up to 60 days ahead), time slot, flats needed (5 to 200) and a group price below the regular price.
- Join a group page (/groups/<id>): choose quantity (1 to 6 ACs/cars etc.), add a note for the team (parking bay, landmark), join, leave, share with neighbours, comment. Neighbours see only first name and block.
- My bookings (/bookings): tabs All, Confirmed, Awaiting provider, Forming, Completed, Closed. Shows date, time slot, partner details after acceptance, and payment status (Unpaid, Payment pending, Paid, Refund due, Refunded).
- Payment: after the group price unlocks you can pay online (UPI, card, netbanking via Razorpay) from the group page, or pay the partner by UPI/cash after the service. Online paid bookings cannot change quantity or leave on their own; contact support. If a group is cancelled, online payments are refunded in 5 to 7 working days.
- Status words: unlocked = flat count reached (price unlocked). Confirmed = a real service partner has accepted. Completed = the partner marked it done. These are separate.

Service partners (providers)
- Partners register at /partner/register choosing the services and cities they cover, log in at /partner/login, dashboard at /partner. They see unlocked jobs for their services and cities, Accept (only one partner gets a job), Reject, Give job back, Mark completed (on or after the service date). Partners get a popup, WhatsApp and SMS alerts when a job unlocks. Partners can reset password at /partner/forgot-password. New partners may need admin approval.

Admin (/admin/login): approves or suspends partners and can release a job from a partner.

Alerts: residents get WhatsApp/SMS when their group unlocks and when a partner accepts (with partner name and phone). Partners get alerts for new unlocked jobs.

Privacy: residents' phone numbers are shown to a partner only after the partner accepts the job. Neighbours never see full flat numbers.
Policies page: /policies (terms, privacy, refunds).
Assistant: this chat can answer questions, book (join a group), start a new group, show bookings, leave a booking, and open pages, in English, Hindi or Hinglish, by typing or by voice.
Demo login for testing: demo@saath.in / demo1234.
`.trim();

export const FEATURES = [
  { id: 'can-do', words: ['help', 'madad', 'features', 'feature', 'sakte', 'sakta', 'sakti', 'capabilities', 'kya kar', 'what can', 'मदद', 'क्या कर', 'सुविधा', 'सुविधाएं', 'options'],
    en: `I can: answer questions about Saath and fix-it tips (AC, RO, sofa, pests), show prices, BOOK a service for you (join your society's group), start a new group, show your bookings, leave a booking, and open any page. Try: "Book AC repair", "Show my bookings", "Start a car wash group", or just describe a problem. Type or tap the mic and speak.`,
    hi: `मैं ये कर सकता हूँ: Saath और घर की समस्याओं (AC, RO, सोफा, कीड़े) के बारे में बताना, कीमतें बताना, आपके लिए सर्विस बुक करना (आपकी सोसाइटी के ग्रुप में जुड़ना), नया ग्रुप शुरू करना, आपकी बुकिंग दिखाना, बुकिंग रद्द करना और कोई भी पेज खोलना। बोलकर देखिए: "AC repair बुक करो", "मेरी बुकिंग दिखाओ", "कार वॉश का नया ग्रुप बनाओ"। टाइप करें या माइक दबाकर बोलें।`,
    hing: `Main ye kar sakta hoon: Saath aur ghar ki problems (AC, RO, sofa, keede) ke baare mein batana, prices batana, aapke liye service BOOK karna (aapki society ke group mein judna), naya group shuru karna, aapki bookings dikhana, booking cancel karna aur koi bhi page kholna. Boliye: "AC repair book karo", "meri bookings dikhao", "car wash ka naya group banao". Type karein ya mic dabakar bolein.` },
  { id: 'what-is-saath', words: ['what is saath', 'about saath', 'saath kya', 'saath kya hai', 'saath ke baare', 'साथ क्या', 'platform', 'company', 'who are you', 'tum kaun', 'aap kaun'],
    en: `Saath lets neighbours in a housing society book home and car services together (AC repair, car wash, deep cleaning, water purifier service, pest control, sofa and carpet cleaning). The more flats join a group, the lower the group price, and a verified service partner does the work on a fixed date and time slot.`,
    hi: `Saath से एक सोसाइटी के पड़ोसी मिलकर घर और कार की सर्विस बुक करते हैं (AC रिपेयर, कार वॉश, डीप क्लीनिंग, वाटर प्यूरीफायर, पेस्ट कंट्रोल, सोफा-कालीन सफाई)। जितने ज़्यादा फ्लैट जुड़ते हैं ग्रुप प्राइस उतना कम होता है, और एक सर्विस पार्टनर तय तारीख और टाइम स्लॉट पर काम करता है।`,
    hing: `Saath se ek society ke padosi milkar ghar aur car ki service book karte hain (AC repair, car wash, deep cleaning, water purifier, pest control, sofa-carpet safai). Jitne zyada flats judte hain group price utna kam hota hai, aur ek service partner tay date aur time slot par kaam karta hai.` },
  { id: 'unlock', words: ['unlock', 'unlocked', 'target', 'flats', 'khulta', 'khulna', 'discount', 'saving', 'bachat', 'सस्ता', 'डिस्काउंट', 'बचत', 'टारगेट', 'cheaper', 'sasta'],
    en: `Every group has a target number of flats. When that many flats join, the group price unlocks for everyone, and you save the difference from the regular price (the group page shows the exact saving). If the target is not reached by the service date, the group does not go ahead and nothing is charged.`,
    hi: `हर ग्रुप का एक टारगेट होता है कि कितने फ्लैट चाहिए। उतने फ्लैट जुड़ते ही सबके लिए ग्रुप प्राइस खुल जाता है और आप सामान्य कीमत से बचत करते हैं (सही बचत ग्रुप पेज पर दिखती है)। सर्विस की तारीख तक टारगेट पूरा न हो तो ग्रुप आगे नहीं बढ़ता और कुछ चार्ज नहीं होता।`,
    hing: `Har group ka ek target hota hai ki kitne flats chahiye. Utne flats judte hi sabke liye group price khul jaata hai aur aap regular price se bachat karte hain (sahi bachat group page par dikhti hai). Service ki date tak target poora na ho to group aage nahi badhta aur kuch charge nahi hota.` },
  { id: 'start-group', words: ['create', 'new group', 'naya group', 'nayi group', 'group banana', 'group banao', 'group start', 'start group', 'start a group', 'host', 'ग्रुप बना', 'नया ग्रुप'],
    en: `To start a group: log in, open "Start a group" (or tell me, e.g. "start a car wash group"), choose the service, a date (tomorrow up to 60 days ahead), an arrival time slot, how many flats are needed (5 to 200) and a group price below the regular price. You become the host and neighbours can join.`,
    hi: `ग्रुप शुरू करने के लिए: लॉग इन करें, "Start a group" खोलें (या मुझसे कहें, जैसे "कार वॉश का ग्रुप बनाओ"), सर्विस, तारीख (कल से 60 दिन तक), टाइम स्लॉट, कितने फ्लैट चाहिए (5 से 200) और रेगुलर प्राइस से कम ग्रुप प्राइस चुनें। आप होस्ट बन जाते हैं और पड़ोसी जुड़ सकते हैं।`,
    hing: `Group shuru karne ke liye: login karein, "Start a group" kholein (ya mujhse kahein, jaise "car wash ka group banao"), service, date (kal se 60 din tak), time slot, kitne flats chahiye (5 se 200) aur regular price se kam group price chunein. Aap host ban jaate hain aur padosi jud sakte hain.` },
  { id: 'partner-join', words: ['partner', 'provider', 'technician banna', 'register', 'vendor', 'join as', 'kaam chahiye', 'job', 'jobs', 'earn', 'kamai', 'पार्टनर', 'प्रोवाइडर', 'नौकरी', 'काम चाहिए'],
    en: `Service partners register at /partner/register, choose the services and cities they cover, and log in at /partner/login. The dashboard shows unlocked jobs that match. A partner can Accept (only one partner gets each job), Reject, Give the job back, and Mark it completed on or after the service date. New partners may need admin approval first.`,
    hi: `सर्विस पार्टनर /partner/register पर रजिस्टर करते हैं, अपनी सर्विस और शहर चुनते हैं और /partner/login से लॉग इन करते हैं। डैशबोर्ड पर मैच होने वाले अनलॉक्ड जॉब दिखते हैं। पार्टनर Accept (हर जॉब सिर्फ एक पार्टनर को मिलता है), Reject, जॉब वापस और सर्विस की तारीख पर या बाद में Completed कर सकता है। नए पार्टनर को पहले एडमिन अप्रूवल लग सकता है।`,
    hing: `Service partner /partner/register par register karte hain, apni service aur city chunte hain aur /partner/login se login karte hain. Dashboard par match hone wale unlocked jobs dikhte hain. Partner Accept (har job sirf ek partner ko milta hai), Reject, job wapas aur service ki date par ya baad mein Completed kar sakta hai. Naye partner ko pehle admin approval lag sakta hai.`,
    links: [['Partner register', '/partner/register'], ['Partner login', '/partner/login']] },
  { id: 'status', words: ['status', 'awaiting', 'confirmed', 'forming', 'unpaid', 'accepted', 'kab aayega', 'kab ayega', 'confirm hua', 'स्टेटस', 'कब आएगा', 'कन्फर्म'],
    en: `Booking status words: "Forming" = still waiting for enough flats. "Awaiting provider" = the flat count is reached and the price is unlocked, but no partner has accepted yet. "Confirmed" = a real partner accepted and the date is fixed. "Completed" = the partner finished. Payment is separate: Unpaid, Payment pending, Paid, Refund due or Refunded. Ask me "show my bookings" to see yours.`,
    hi: `बुकिंग स्टेटस का मतलब: "Forming" = अभी काफ़ी फ्लैट नहीं जुड़े। "Awaiting provider" = फ्लैट पूरे हो गए और कीमत खुल गई, पर अभी किसी पार्टनर ने स्वीकार नहीं किया। "Confirmed" = पार्टनर ने स्वीकार कर लिया और तारीख पक्की है। "Completed" = काम पूरा। पेमेंट अलग है: Unpaid, Payment pending, Paid, Refund due या Refunded। अपनी बुकिंग देखने के लिए कहें "मेरी बुकिंग दिखाओ"।`,
    hing: `Booking status ka matlab: "Forming" = abhi kaafi flats nahi jude. "Awaiting provider" = flats poore ho gaye aur price khul gaya, par abhi kisi partner ne accept nahi kiya. "Confirmed" = partner ne accept kar liya aur date pakki hai. "Completed" = kaam poora. Payment alag hai: Unpaid, Payment pending, Paid, Refund due ya Refunded. Apni bookings dekhne ke liye kahein "meri bookings dikhao".` },
  { id: 'alerts', words: ['alert', 'alerts', 'notification', 'notifications', 'whatsapp', 'sms', 'message aayega', 'popup', 'सूचना', 'नोटिफिकेशन', 'व्हाट्सऐप'],
    en: `Residents get WhatsApp or SMS when their group unlocks and when a partner accepts (with the partner's name and number). Partners get a popup on the site plus WhatsApp and SMS when a new job unlocks for their service and city.`,
    hi: `ग्रुप अनलॉक होने पर और पार्टनर के स्वीकार करने पर (पार्टनर के नाम और नंबर के साथ) निवासियों को WhatsApp या SMS मिलता है। पार्टनर को अपनी सर्विस और शहर के नए जॉब पर साइट पर पॉपअप और WhatsApp व SMS मिलता है।`,
    hing: `Group unlock hone par aur partner ke accept karne par (partner ke naam aur number ke saath) residents ko WhatsApp ya SMS milta hai. Partner ko apni service aur city ke naye job par site par popup aur WhatsApp va SMS milta hai.` },
  { id: 'privacy', words: ['privacy', 'private', 'phone number', 'number dikh', 'safe', 'secure', 'surakshit', 'गोपनीयता', 'प्राइवेसी', 'नंबर दिख'],
    en: `Your privacy: neighbours see only your first name and block, never your full flat number. A partner sees your phone number only after they accept your group's job. Card and UPI details are handled by Razorpay, not stored by Saath.`,
    hi: `आपकी प्राइवेसी: पड़ोसी सिर्फ आपका पहला नाम और ब्लॉक देखते हैं, पूरा फ्लैट नंबर कभी नहीं। पार्टनर आपका फोन नंबर तभी देखता है जब वह आपके ग्रुप का जॉब स्वीकार कर लेता है। कार्ड और UPI की जानकारी Razorpay संभालता है, Saath सेव नहीं करता।`,
    hing: `Aapki privacy: padosi sirf aapka pehla naam aur block dekhte hain, poora flat number kabhi nahi. Partner aapka phone number tabhi dekhta hai jab wo aapke group ka job accept kar leta hai. Card aur UPI ki jaankari Razorpay sambhalta hai, Saath save nahi karta.` },
  { id: 'share', words: ['share', 'invite', 'neighbour', 'neighbours', 'padosi', 'comment', 'comments', 'dost', 'पड़ोसी', 'शेयर', 'कमेंट'],
    en: `On any group page tap "Share with neighbours" to send the link on WhatsApp or copy it, and use the comments box to talk to neighbours in your society. The more neighbours join, the sooner the price unlocks.`,
    hi: `किसी भी ग्रुप पेज पर "Share with neighbours" दबाकर लिंक WhatsApp पर भेजें या कॉपी करें, और कमेंट बॉक्स से अपनी सोसाइटी के पड़ोसियों से बात करें। जितने पड़ोसी जुड़ेंगे कीमत उतनी जल्दी खुलेगी।`,
    hing: `Kisi bhi group page par "Share with neighbours" dabakar link WhatsApp par bhejein ya copy karein, aur comment box se apni society ke padosiyon se baat karein. Jitne padosi judenge price utni jaldi khulega.` },
  { id: 'units', words: ['quantity', 'units', 'kitne ac', 'ek se zyada', 'multiple', 'two ac', 'more than one', 'matra', 'संख्या', 'ज़्यादा', 'zyada'],
    en: `When you join a group you choose the quantity (1 to 6), for example the number of ACs or cars. You can change it later from the group page, unless you have already paid online. For flat-based services like deep cleaning and pest control it is one booking per flat.`,
    hi: `ग्रुप से जुड़ते समय आप मात्रा चुनते हैं (1 से 6), जैसे कितने AC या कार। बाद में ग्रुप पेज से बदल सकते हैं, पर ऑनलाइन पेमेंट के बाद नहीं। डीप क्लीनिंग और पेस्ट कंट्रोल जैसी फ्लैट-वाली सर्विस में हर फ्लैट की एक बुकिंग होती है।`,
    hing: `Group se judte samay aap quantity chunte hain (1 se 6), jaise kitne AC ya car. Baad mein group page se badal sakte hain, par online payment ke baad nahi. Deep cleaning aur pest control jaisi flat-wali service mein har flat ki ek booking hoti hai.` },
  { id: 'demo', words: ['demo', 'test login', 'trial', 'dummy', 'डेमो'],
    en: `For testing you can log in with the demo account: demo@saath.in and password demo1234.`,
    hi: `टेस्टिंग के लिए आप डेमो अकाउंट से लॉग इन कर सकते हैं: demo@saath.in और पासवर्ड demo1234।`,
    hing: `Testing ke liye aap demo account se login kar sakte hain: demo@saath.in aur password demo1234.` },
  { id: 'admin', words: ['admin', 'administrator', 'approve', 'suspend', 'एडमिन'],
    en: `Admins log in at /admin/login. They approve or suspend service partners and can release a job from a partner so other partners can take it. There is no public admin sign-up.`,
    hi: `एडमिन /admin/login से लॉग इन करते हैं। वे सर्विस पार्टनर को अप्रूव या सस्पेंड करते हैं और किसी पार्टनर से जॉब वापस लेकर दूसरों के लिए खोल सकते हैं। एडमिन का पब्लिक साइन-अप नहीं है।`,
    hing: `Admin /admin/login se login karte hain. Wo service partners ko approve ya suspend karte hain aur kisi partner se job wapas lekar doosron ke liye khol sakte hain. Admin ka public sign-up nahi hai.` },
  { id: 'voice', words: ['voice', 'bol', 'bolna', 'bolkar', 'awaaz', 'mic', 'mike', 'speak', 'listen', 'sunao', 'suno', 'आवाज़', 'माइक', 'बोलकर'],
    en: `You can talk to me. Tap the mic, speak in Hindi, English or Hinglish, and I send it when you stop. Tap the speaker icon in the chat header to hear my answers in a female voice. For best results use Chrome, and allow the microphone.`,
    hi: `आप मुझसे बोलकर बात कर सकते हैं। माइक दबाएँ, हिंदी, English या Hinglish में बोलें, रुकते ही मैं भेज देता हूँ। चैट के ऊपर स्पीकर आइकन दबाकर मेरे जवाब महिला आवाज़ में सुनें। सबसे अच्छे नतीजे के लिए Chrome इस्तेमाल करें और माइक की अनुमति दें।`,
    hing: `Aap mujhse bolkar baat kar sakte hain. Mic dabayein, Hindi, English ya Hinglish mein bolein, rukte hi main bhej deta hoon. Chat ke upar speaker icon dabakar mere jawab female awaaz mein sunein. Best result ke liye Chrome use karein aur mic ki permission dein.` },
  { id: 'warranty', words: ['warranty', 'guarantee', 'redo', 'complaint', 'not happy', 'unhappy', 'quality', 'gunwatta', 'वारंटी', 'गारंटी'],
    en: `Services come with a service warranty (for example 30 days for AC, 60 days for water purifier, 90 days for pest control). If a finished service is not good, report it within 48 hours and the partner will redo it or you can ask for a refund.`,
    hi: `सर्विस पर वारंटी मिलती है (जैसे AC पर 30 दिन, वाटर प्यूरीफायर पर 60 दिन, पेस्ट कंट्रोल पर 90 दिन)। पूरी हुई सर्विस ठीक न लगे तो 48 घंटे में बताएँ, पार्टनर दोबारा करेगा या आप रिफंड माँग सकते हैं।`,
    hing: `Services par warranty milti hai (jaise AC par 30 din, water purifier par 60 din, pest control par 90 din). Poori hui service theek na lage to 48 ghante mein batayein, partner dobara karega ya aap refund maang sakte hain.` },
  { id: 'forgot', words: ['forgot', 'bhool', 'bhul', 'reset', 'password', 'otp', 'पासवर्ड', 'भूल'],
    en: `Forgot your password? Open the Forgot password page, enter your email, and we send a 6-digit code to your email and mobile. The code works for 15 minutes, once, with 5 tries. Partners use the partner version of the page.`,
    hi: `पासवर्ड भूल गए? Forgot password पेज पर अपना ईमेल डालें, हम ईमेल और मोबाइल पर 6 अंकों का कोड भेजते हैं। कोड 15 मिनट तक, एक बार और 5 कोशिशों तक चलता है। पार्टनर पार्टनर वाला पेज इस्तेमाल करें।`,
    hing: `Password bhool gaye? Forgot password page par apna email dalein, hum email aur mobile par 6 ank ka code bhejte hain. Code 15 minute tak, ek baar aur 5 koshishon tak chalta hai. Partner, partner wala page use karein.`,
    links: [['Forgot password', '/forgot-password']] },
];

// Pages the assistant can open ("take me to bookings").
export const PAGES = [
  { to: '/bookings', words: ['bookings', 'booking', 'my bookings', 'बुकिंग', 'orders'], label: { en: 'My bookings', hi: 'मेरी बुकिंग', hing: 'My bookings' } },
  { to: '/services', words: ['services', 'service page', 'सेवाएं', 'सर्विस'], label: { en: 'Services', hi: 'सर्विसेज़', hing: 'Services' } },
  { to: '/groups', words: ['groups', 'group', 'ग्रुप'], label: { en: 'Groups', hi: 'ग्रुप्स', hing: 'Groups' } },
  { to: '/new', words: ['new group', 'start a group', 'naya group', 'नया ग्रुप'], label: { en: 'Start a group', hi: 'नया ग्रुप', hing: 'Naya group' } },
  { to: '/login', words: ['login', 'log in', 'sign in', 'लॉगिन'], label: { en: 'Log in', hi: 'लॉग इन', hing: 'Log in' } },
  { to: '/signup', words: ['signup', 'sign up', 'register', 'account banao', 'साइन अप'], label: { en: 'Sign up', hi: 'साइन अप', hing: 'Sign up' } },
  { to: '/partner/register', words: ['partner register', 'partner signup', 'become partner', 'partner banna'], label: { en: 'Partner sign-up', hi: 'पार्टनर रजिस्टर', hing: 'Partner register' } },
  { to: '/partner/login', words: ['partner login'], label: { en: 'Partner login', hi: 'पार्टनर लॉगिन', hing: 'Partner login' } },
  { to: '/partner', words: ['partner dashboard', 'partner page', 'dashboard'], label: { en: 'Partner dashboard', hi: 'पार्टनर डैशबोर्ड', hing: 'Partner dashboard' } },
  { to: '/policies', words: ['policies', 'policy', 'terms', 'privacy policy', 'refund policy', 'नीति'], label: { en: 'Policies', hi: 'नीतियाँ', hing: 'Policies' } },
  { to: '/forgot-password', words: ['forgot password', 'reset password', 'password reset'], label: { en: 'Forgot password', hi: 'पासवर्ड भूले', hing: 'Forgot password' } },
  { to: '/', words: ['home', 'home page', 'homepage', 'होम'], label: { en: 'Home', hi: 'होम', hing: 'Home' } },
];
