import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import DrawOutlineButton from './draw-outline-button'

describe('DrawOutlineButton Component', () => {
  it('renders correctly with children text', () => {
    render(<DrawOutlineButton>Book Now</DrawOutlineButton>)
    const buttonElement = screen.getByText('Book Now')
    expect(buttonElement).toBeInTheDocument()
  })

  it('triggers onClick handler when clicked', () => {
    const handleClick = jest.fn()
    render(<DrawOutlineButton onClick={handleClick}>Book Now</DrawOutlineButton>)
    const buttonElement = screen.getByRole('button', { name: /book now/i })
    fireEvent.click(buttonElement)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
