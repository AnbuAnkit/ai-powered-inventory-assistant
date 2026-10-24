"""Narrow database tools available to the chat model."""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

from langchain_core.tools import BaseTool, tool

from . import dataset


def _date(value: str | None) -> date | None:
    if value is None:
        return None
    return date.fromisoformat(value)


def _date_range(
    start_date: str | None, end_date: str | None
) -> tuple[date | None, date | None]:
    start = _date(start_date)
    end = _date(end_date)
    if start is not None and end is not None and start > end:
        raise ValueError("start_date must not be after end_date")
    return start, end


def create_database_tools(database_path: Path) -> list[BaseTool]:
    """Build sales read tools and persistent inventory management tools."""

    @tool
    def search_sales(
        region: str | None = None,
        category: str | None = None,
        product: str | None = None,
        salesperson: str | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        limit: int = 20,
    ) -> str:
        """Search imported sales records using optional filters and ISO dates.

        Sales records are read-only. The maximum result limit is 100.
        """
        if not 1 <= limit <= 100:
            raise ValueError("limit must be between 1 and 100")
        start, end = _date_range(start_date, end_date)
        return json.dumps(
            dataset.query_sales(
                database_path,
                region=region,
                category=category,
                product=product,
                salesperson=salesperson,
                start_date=start,
                end_date=end,
                limit=limit,
            ),
            ensure_ascii=False,
        )

    @tool
    def summarize_sales(
        region: str | None = None,
        category: str | None = None,
        product: str | None = None,
        salesperson: str | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> str:
        """Calculate sales totals and breakdowns for optional filters and ISO dates."""
        start, end = _date_range(start_date, end_date)
        return json.dumps(
            dataset.summarize_sales(
                database_path,
                region=region,
                category=category,
                product=product,
                salesperson=salesperson,
                start_date=start,
                end_date=end,
            ),
            ensure_ascii=False,
        )

    @tool
    def rank_products_by_profit(
        region: str | None = None,
        category: str | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        limit: int = 10,
    ) -> str:
        """Rank products by summed profit from the sales table, highest first.

        Use this for questions about the most profitable or highest-profit
        product. This reports profit and sales totals, not a unit price.
        """
        start, end = _date_range(start_date, end_date)
        return json.dumps(
            dataset.rank_products_by_profit(
                database_path,
                region=region,
                category=category,
                start_date=start,
                end_date=end,
                limit=limit,
            ),
            ensure_ascii=False,
        )

    @tool
    def list_inventory_items(product: str | None = None) -> str:
        """Read inventory items, optionally filtering by part of the product name."""
        return json.dumps(
            dataset.list_inventory_items(database_path, product=product),
            ensure_ascii=False,
        )

    @tool
    def add_inventory_item(
        product: str,
        stock_quantity: int,
        supplier: str = "",
        reorder_point: int = 0,
    ) -> str:
        """Add an inventory item with stock, supplier, and reorder-point details."""
        return json.dumps(
            dataset.add_inventory_item(
                database_path,
                product=product,
                stock_quantity=stock_quantity,
                supplier=supplier,
                reorder_point=reorder_point,
            ),
            ensure_ascii=False,
        )

    @tool
    def update_inventory_item(
        product: str,
        stock_quantity: int | None = None,
        supplier: str | None = None,
        reorder_point: int | None = None,
    ) -> str:
        """Update one or more fields of an existing inventory item."""
        return json.dumps(
            dataset.update_inventory_item(
                database_path,
                product=product,
                stock_quantity=stock_quantity,
                supplier=supplier,
                reorder_point=reorder_point,
            ),
            ensure_ascii=False,
        )

    @tool
    def delete_inventory_item(product: str) -> str:
        """Delete an inventory item by its exact product name."""
        dataset.delete_inventory_item(database_path, product=product)
        return json.dumps({"deleted": product})

    return [
        search_sales,
        summarize_sales,
        rank_products_by_profit,
        list_inventory_items,
        add_inventory_item,
        update_inventory_item,
        delete_inventory_item,
    ]
