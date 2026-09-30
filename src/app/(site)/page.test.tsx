import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import HomePage from "@/app/(site)/page";
import { navItems } from "@/content/shell";
import { placeholderHome } from "@/content/site";

it("renders the placeholder heading and message", () => {
  render(<HomePage />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    placeholderHome.titleEmphasis,
  );
  expect(screen.getByText(placeholderHome.body)).toBeInTheDocument();
});

it("has a section for every nav-rail link", () => {
  const { container } = render(<HomePage />);
  for (const item of navItems) {
    expect(container.querySelector(`section#${item.id}`)).toHaveAccessibleName(
      item.label,
    );
  }
});
