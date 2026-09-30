import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import HomePage from "@/app/page";
import { placeholderHome } from "@/content/site";

it("renders the placeholder heading and message", () => {
  render(<HomePage />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    placeholderHome.titleEmphasis,
  );
  expect(screen.getByText(placeholderHome.body)).toBeInTheDocument();
});
