// Strings for buying courses (B1) and doctors' own courses (B2): the course
// page, the cart line, "My courses" on /account, the doctor's course area,
// staff review and the notifications.

const rupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export const courses = {
  card: {
    price: (paise: number) => rupees(paise),
    view: "View course",
  },

  page: {
    eyebrow: "Course",
    by: (name: string) => `By ${name}`,
    facts: "Course details",
    duration: "Duration",
    price: "Price",
    priceNote: "Including GST. You get a GST invoice.",
    about: "About this course",
    video: "Introduction video",
    back: "All courses",
    enrol: "Enrol: add to cart",
    inCart: "In your cart",
    goToCart: "Go to cart",
    added: "Added to your cart",
    addedLine: (title: string) => `${title} is in your cart. Check out to pay by QR or bank transfer.`,
    signInToEnrol: "Sign in to enrol",
    enrolledTitle: "You're enrolled",
    enrolledText: "Here is how to join. Keep this page handy; it's also under My courses on your account.",
    accessTitle: "How to join",
    accessEmpty: "The instructor will add the joining details soon. We'll let you know.",
    notForSaleTitle: "Enrolment opens soon",
    notForSaleText: "Call us and our team will help you join.",
    call: (phone: string) => `Call ${phone}`,
    previewNote: "Only you and our staff can see this page until the course is approved.",
    authorAccessNote: "Enrolled buyers see this:",
    errors: {
      unavailable: "This course can't be bought right now.",
      enrolled: "You're already enrolled in this course.",
    },
  },

  cartLine: {
    kind: "Online course",
    note: "Nothing to deliver. You can join as soon as your payment is confirmed.",
    listLabel: "Courses",
    by: (name: string) => `By ${name}`,
    enrolled: "You're already enrolled. Remove it from your cart.",
    unavailable: "This course can't be bought right now. Remove it from your cart.",
    removeLabel: (title: string) => `Remove ${title} from the cart`,
  },

  order: {
    title: "Your courses",
    ready: "Open each course to see how to join.",
    unpaid: "You're enrolled once this order is paid.",
    cancelled: "This order was cancelled, so it doesn't enrol you.",
  },

  account: {
    shortcut: { label: "My courses", help: "Courses you've enrolled in" },
    teachShortcut: { label: "Teach a course", help: "Create and manage your own courses" },
    title: "My courses",
    empty: "You haven't enrolled in a course yet.",
    browse: "Browse courses",
    open: "Open course",
    enrolledOn: (date: string) => `Enrolled ${date}`,
  },

  teachCallout: {
    title: "Are you an Ayurveda doctor?",
    text: "Create your own course. Our team checks it, then it's listed here for everyone to buy.",
    action: "Teach a course",
  },

  doctor: {
    metaTitle: "My courses",
    eyebrow: "Teach",
    title: "Your courses",
    description: "Create a course, set its price and joining details. Our team checks each one before it's listed.",
    newCourse: "Create a course",
    editTitle: "Edit your course",
    newTitle: "Create a course",
    empty: "You haven't created a course yet.",
    enrolments: (count: number) => `${count} ${count === 1 ? "enrolment" : "enrolments"}`,
    edit: "Edit",
    view: "View page",
    delete: "Delete",
    deleteConfirm: "Delete this course? This can't be undone.",
    deleted: "Course deleted.",
    saved: "Saved. Our team will check your course before it's listed.",
    notPriced: "No price: not sold online",
    status: {
      pending: "Waiting for review",
      published: "Listed",
      rejected: "Needs changes",
    },
    hidden: "Hidden by our team",
    reviewNote: (note: string) => `Our team's note: ${note}`,
    payoutNote:
      "Our team pays your share of course sales by bank transfer, as agreed with you. Questions? Call us.",
    notDoctor: {
      title: "For verified doctors",
      text: "Only Ayurveda doctors whose documents our team has checked can create courses.",
      account: "Go to my account",
    },
    fields: {
      title: "Course title",
      tag: "Topic",
      tagHelp: "A short topic used to filter courses, e.g. \"Panchakarma\".",
      body: "Short summary",
      bodyHelp: "One or two sentences for the course card.",
      details: "About this course",
      detailsHelp: "What the course covers, who it's for, and what they'll learn.",
      format: "Format",
      formatHelp: "How it's taught, e.g. \"Live online, 6 sessions\" or \"Recorded videos\".",
      duration: "Duration",
      durationHelp: "e.g. \"6 weeks\" or \"12 hours\".",
      price: "Price in rupees, including GST",
      priceHelp: "Leave blank to list the course without online sales; people then call us to join.",
      videoUrl: "YouTube introduction video",
      accessDetails: "Joining details for enrolled buyers",
      accessDetailsHelp:
        "Only people who bought the course see this: the meeting link, schedule, or where to find the materials.",
      submit: "Send for review",
      cancel: "Cancel",
    },
    errors: {
      title: "Enter a title of up to 160 characters.",
      tag: "Enter a topic of up to 60 characters.",
      body: "Enter a summary of up to 300 characters.",
      details: "Enter a description of up to 5,000 characters.",
      format: "Enter the format, up to 80 characters.",
      duration: "Use up to 40 characters.",
      price: "Enter a price in rupees, such as 1499, up to ₹5,00,000. Or leave it blank.",
      videoUrl: "Use a YouTube link (youtube.com or youtu.be).",
      accessDetails: "Use up to 2,000 characters.",
      notFound: "That course wasn't found.",
      hasEnrolments: "People have enrolled in this course, so it can't be deleted. Ask our team to hide it.",
      forbidden: "Only verified Ayurveda doctors can create courses.",
      generic: "Something went wrong. Please try again.",
    },
  },

  review: {
    title: "Review",
    by: (name: string) => `Made by ${name}`,
    staffMade: "Made by staff",
    status: "Status",
    note: "Note to the doctor (needed to send it back)",
    approve: "Approve and list",
    reject: "Send back for changes",
    approved: "Approved. The course is listed.",
    rejected: "Sent back to the doctor with your note.",
    noteNeeded: "Write a note so the doctor knows what to change.",
    enrolments: (count: number) => `${count} paid ${count === 1 ? "enrolment" : "enrolments"}`,
  },

  notify: {
    submitted: {
      title: (title: string) => `Course to review: ${title}`,
      body: (doctor: string) => `${doctor} sent a course for review.`,
    },
    approved: {
      title: (title: string) => `Your course is listed: ${title}`,
      body: "Our team approved it. People can now find it on the Courses page.",
    },
    rejected: {
      title: (title: string) => `Your course needs changes: ${title}`,
      body: (note: string) => note,
    },
    enrolled: {
      title: (title: string) => `New enrolment: ${title}`,
      body: (name: string) => `${name} enrolled in your course.`,
    },
    buyer: {
      title: (title: string) => `You're enrolled: ${title}`,
      body: "Open the course page to see how to join.",
    },
  },

  /** Admin course form additions. */
  admin: {
    sectionTitle: "Selling online",
    price: "Price in rupees, including GST",
    priceHelp: "Leave blank to keep the course off online sales (the card then offers a call).",
    gstRate: "GST rate (%)",
    details: "About this course",
    accessDetails: "Joining details for enrolled buyers",
    accessDetailsHelp: "Only buyers, the doctor and staff see this.",
    authorColumn: "Made by",
    statusColumn: "Review",
    errors: {
      price: "Enter a price in rupees, up to ₹5,00,000, or leave it blank.",
      gstRate: "Choose a GST rate.",
      details: "Use up to 5,000 characters.",
      accessDetails: "Use up to 2,000 characters.",
      hasEnrolments: "People have enrolled in this course, so it can't be deleted. Untick \"Show on the site\" to hide it instead.",
    },
  },
} as const;
