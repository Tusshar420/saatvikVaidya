import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OtpInput } from "./otp-input";

function setup(props: Partial<Parameters<typeof OtpInput>[0]> = {}) {
  const onValueChange = vi.fn();
  const onComplete = vi.fn();
  render(
    <OtpInput
      label="Enter the code"
      onValueChange={onValueChange}
      onComplete={onComplete}
      {...props}
    />,
  );
  const boxes = screen.getAllByRole("textbox");
  return { boxes, onValueChange, onComplete, user: userEvent.setup() };
}

const values = (boxes: HTMLElement[]) =>
  boxes.map((box) => (box as HTMLInputElement).value).join("");

describe("OtpInput", () => {
  it("renders six labelled numeric boxes in a named group", () => {
    const { boxes } = setup();
    expect(boxes).toHaveLength(6);
    expect(
      screen.getByRole("group", { name: "Enter the code" }),
    ).toBeInTheDocument();
    expect(boxes[0]).toHaveAccessibleName("Digit 1 of 6");
    expect(boxes[0]).toHaveAttribute("autocomplete", "one-time-code");
    for (const box of boxes)
      expect(box).toHaveAttribute("inputmode", "numeric");
  });

  it("moves to the next box after each digit", async () => {
    const { boxes, user } = setup();
    await user.click(boxes[0]);
    await user.keyboard("1");
    expect(boxes[1]).toHaveFocus();
    await user.keyboard("2");
    expect(boxes[2]).toHaveFocus();
    expect(values(boxes)).toBe("12");
  });

  it("ignores letters", async () => {
    const { boxes, user } = setup();
    await user.click(boxes[0]);
    await user.keyboard("a");
    expect(boxes[0]).toHaveValue("");
    expect(boxes[0]).toHaveFocus();
  });

  it("fills every box when a full code is pasted", async () => {
    const { boxes, onComplete, user } = setup();
    await user.click(boxes[0]);
    await user.paste("482913");
    expect(values(boxes)).toBe("482913");
    expect(onComplete).toHaveBeenCalledWith("482913");
    expect(boxes[5]).toHaveFocus();
  });

  it("strips spaces and text from a pasted code", async () => {
    const { boxes, user } = setup();
    await user.click(boxes[0]);
    await user.paste("Your code: 482 913");
    expect(values(boxes)).toBe("482913");
  });

  it("starts a full pasted code at the first box, wherever the focus is", async () => {
    const { boxes, user } = setup();
    await user.click(boxes[3]);
    await user.paste("482913");
    expect(values(boxes)).toBe("482913");
  });

  it("fills from the focused box when part of a code is pasted", async () => {
    const { boxes, user } = setup();
    await user.click(boxes[0]);
    await user.keyboard("48");
    await user.paste("29");
    expect(values(boxes)).toBe("4829");
    expect(boxes[4]).toHaveFocus();
  });

  it("calls onComplete once the last digit is typed", async () => {
    const { boxes, onComplete, user } = setup();
    await user.click(boxes[0]);
    await user.keyboard("12345");
    expect(onComplete).not.toHaveBeenCalled();
    await user.keyboard("6");
    expect(onComplete).toHaveBeenCalledWith("123456");
  });

  it("backspace on an empty box clears and focuses the previous one", async () => {
    const { boxes, user } = setup();
    await user.click(boxes[0]);
    await user.keyboard("12");
    expect(boxes[2]).toHaveFocus();
    await user.keyboard("{Backspace}");
    expect(boxes[1]).toHaveFocus();
    expect(values(boxes)).toBe("1");
  });

  it("replaces a digit when typing into a filled box", async () => {
    const { boxes, user } = setup({ defaultValue: "123456" });
    await user.click(boxes[2]);
    await user.keyboard("9");
    expect(values(boxes)).toBe("129456");
    expect(boxes[3]).toHaveFocus();
  });

  it("moves with the arrow keys", async () => {
    const { boxes, user } = setup();
    await user.click(boxes[2]);
    await user.keyboard("{ArrowLeft}");
    expect(boxes[1]).toHaveFocus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(boxes[3]).toHaveFocus();
  });

  it("submits the joined code under `name`", async () => {
    const { container } = render(
      <form>
        <OtpInput label="Code" name="otp" defaultValue="4829" />
      </form>,
    );
    const form = container.querySelector("form")!;
    expect(new FormData(form).get("otp")).toBe("4829");
  });

  it("resets when the controlled value is cleared", async () => {
    function Controlled() {
      const [code, setCode] = useState("");
      return (
        <>
          <OtpInput label="Code" value={code} onValueChange={setCode} />
          <button type="button" onClick={() => setCode("")}>
            Resend
          </button>
        </>
      );
    }
    render(<Controlled />);
    const user = userEvent.setup();
    const boxes = screen.getAllByRole("textbox");
    await user.click(boxes[0]);
    await user.paste("123456");
    expect(values(boxes)).toBe("123456");
    await user.click(screen.getByRole("button", { name: "Resend" }));
    expect(values(boxes)).toBe("");
  });
});
