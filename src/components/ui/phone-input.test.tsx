import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PhoneInput } from "./phone-input";

function setup(props: Partial<Parameters<typeof PhoneInput>[0]> = {}) {
  const onValueChange = vi.fn();
  render(
    <PhoneInput
      label="Mobile number"
      onValueChange={onValueChange}
      {...props}
    />,
  );
  const input = screen.getByRole("textbox", { name: /mobile number/i });
  return { input, onValueChange, user: userEvent.setup() };
}

describe("PhoneInput", () => {
  it("has the +91 prefix and phone input hints", () => {
    const { input } = setup();
    expect(screen.getByText("+91")).toBeInTheDocument();
    expect(input).toHaveAccessibleName("Mobile number (+91)");
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(input).toHaveAttribute("autocomplete", "tel-national");
    expect(input).toHaveAttribute("type", "tel");
  });

  it("keeps at most 10 digits", async () => {
    const { input, onValueChange, user } = setup();
    await user.type(input, "987654321012345");
    expect(input).toHaveValue("9876543210");
    expect(onValueChange).toHaveBeenLastCalledWith("9876543210");
  });

  it("ignores letters, spaces and symbols", async () => {
    const { input, user } = setup();
    await user.type(input, "98a7 6-5(4)3.2+1x0");
    expect(input).toHaveValue("9876543210");
  });

  it("strips a +91 prefix from a pasted number", async () => {
    const { input, user } = setup();
    await user.click(input);
    await user.paste("+91 92203 58400");
    expect(input).toHaveValue("9220358400");
  });

  it("strips a leading 0 from a pasted number", async () => {
    const { input, user } = setup();
    await user.click(input);
    await user.paste("09220358400");
    expect(input).toHaveValue("9220358400");
  });

  it("works as a controlled input", async () => {
    function Controlled() {
      const [value, setValue] = useState("");
      return (
        <>
          <PhoneInput
            label="Mobile number"
            value={value}
            onValueChange={setValue}
          />
          <output>{value}</output>
        </>
      );
    }
    render(<Controlled />);
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox"), "92203x584001234");
    expect(screen.getByRole("status")).toHaveTextContent(/^9220358400$/);
  });

  it("links the error message and marks the field invalid", () => {
    const { input } = setup({ error: "Enter a 10-digit mobile number." });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(
      "Enter a 10-digit mobile number.",
    );
  });
});
