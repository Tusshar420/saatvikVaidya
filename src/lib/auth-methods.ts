// Which sign-in methods the sign-in modal offers.
//
// Phone (SMS code) sign-in is hidden for now: there is no SMS provider yet,
// so codes would only reach the server log. The server side still works;
// set this to true once SMS delivery (MSG91) is live to bring the Mobile
// tab back. Email codes and email + password are always offered.
export const phoneSignInEnabled = false;
